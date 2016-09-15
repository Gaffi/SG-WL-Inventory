// ==UserScript==
// @name         SteamGifts Inventory Checker
// @namespace    https://github.com/Gaffi/SG-WL-Inventory
// @version      0.08
// @description  Scans your whitelist for a particular game to see how many on your list own it. Many props to Sighery for helping me with the API business and for creating the code I butchered to make this.
// @author       Gaffi
// icon
// @downloadURL  https://github.com/Gaffi/SG-WL-Inventory/raw/master/SG-WL-Inventory.user.js
// @supportURL   https://github.com/Gaffi/SG-WL-Inventory/raw/master/SG-WL-Inventory.meta.js
// @supportURL   https://github.com/Gaffi/SG-WL-Inventory
// @match        https://www.steamgifts.com/account/manage/whitelist*
// @match		 http://store.steampowered.com/app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_log
// @connect      api.steampowered.com
// @connect      store.steampowered.com
// @connect		 www.steamgifts.com
// @connect 	 steamcommunity.com
// ==/UserScript==

var apiKey = null;
var appInput = null;
var totalScanned = 0;
var totalHave = 0;
var wlCount = 0;
var wlPages = 0;
var gameTitle = null;
var inventoryDiv;
var urlWhitelist = 'https://www.steamgifts.com/account/manage/whitelist';
//var urlWishlist = 'http://steamcommunity.com/profiles/ ... /wishlist';
//var searchWishlistHTML = 'wishlist_remove_ ..... ';
var urlSteamApp = 'store.steampowered.com/app/';
var useSteam = false;

var keyStorageUpdated = 'SG_WL_Inventory_last_updated';
var keyStorageOwnData = 'SG_WL_Inventory_user_own_data';
var keyStorageWishData = 'SG_WL_Inventory_user_wish_data';

var cacheDate = new Date();
cacheDate.setDate(new Date().getDate()-1);

var LAST_UPDATED = localStorage.getItem(keyStorageUpdated);
var USER_OWN_DATA, USER_WISH_DATA;

if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (obj, fromIndex) {
    if (fromIndex === null) {
        fromIndex = 0;
    } else if (fromIndex < 0) {
        fromIndex = Math.max(0, this.length + fromIndex);
    }
    for (var i = fromIndex, j = this.length; i < j; i++) {
        if (this[i] === obj)
            return i;
    }
    return -1;
  };
}

window.onload = function() {
	if (window.location.href.indexOf(urlSteamApp)>0) {
		console.log('SteamGifts Inventory Checker Injecting Steam Store');
		useSteam = true;
		injectInterfaceSteam();
	} else {
		console.log('SteamGifts Inventory Checker Injecting SteamGifts');
		useSteam = false;
		injectInterfaceSG();
	}
};

/**
 * Adds button to Steam store to run checking process
 */
function injectInterfaceSteam() {
    var refTarget;
    refTarget = document.getElementsByClassName('apphub_OtherSiteInfo')[0];

	console.log('Creating button/progress bar on Steam store...');
	inventoryDiv = document.createElement("DIV");
    inventoryDiv.id = "whitelist_ownership_checker";
    inventoryDiv.className = 'btnv6_blue_hoverfade btn_medium';
    inventoryDiv.innerHTML = "<span>Check SteamGifts game ownership</span>";
    refTarget.appendChild(inventoryDiv);
    document.getElementById('whitelist_ownership_checker').addEventListener('click', checkWL, false);
	
	/*
	* This section may be implemented later to allow for caching from Steam store. Cache is not shared between SG and Steam, however, and the nature of this process makes me want to avoid it.
	// Removing Steam's localStorage. This is surely not optimal, but Steam uses up as much localStorage as possible, so there is no way to cache unless we make some room.
	for (var i = 0; i < localStorage.length; i++){
		if (localStorage.key(i) != 'APIKey' && localStorage.key(i) != keyStorageUpdated && localStorage.key(i) != keyStorageOwnData && localStorage.key(i) != keyStorageWishData) {
			localStorage.removeItem(localStorage.key(i));
		}
	}
	*/
	
	var curURL = window.location.href;
	if (curURL.lastIndexOf('/')+1 != curURL.length) {
		curURL += '/';
	}
	appInput = curURL.slice(curURL.lastIndexOf('/',curURL.length-2)+1,curURL.lastIndexOf('/',curURL.length));
	getWLCounts(false);
	console.log('Whitelist inventory button loaded without errors.');
}

/**
 * Adds button to SteamGifts whitelist page to run checking process
 */
function injectInterfaceSG() {
	var bFound=0;
    var i=0;
    var refTarget;
    while(bFound===0) {
        refTarget = document.getElementsByClassName('page__heading__breadcrumbs')[i];
        if (refTarget.innerHTML.indexOf('<a href="/account">Account</a><i class="fa fa-angle-right"></i><a href="/account/manage/whitelist">Whitelist</a>')===0) {
            bFound = 1;
        } else i++;
    }

	console.log('Creating button/progress bar on SteamGifts...');
	inventoryDiv = document.createElement("DIV");
    inventoryDiv.id = "whitelist_ownership_checker";
    inventoryDiv.className = 'form__submit-button';
    inventoryDiv.innerHTML = "<i class='fa fa-arrow-circle-right'></i> Check game ownership";
    refTarget.parentNode.appendChild(inventoryDiv);
    document.getElementById('whitelist_ownership_checker').addEventListener('click', checkWL, false);
	getWLCounts(true);
	console.log('Whitelist inventory button loaded without errors.');
}

/**
 * Kicks off checking routine, initiated by button click on user interface.
 */
function checkWL() {
	console.log('Last updated: ' + LAST_UPDATED + ' - Needs to be updated if last updated before: ' + cacheDate);
	var user_own_data = localStorage.getItem(keyStorageOwnData);
	var user_wish_data = localStorage.getItem(keyStorageWishData);

	if (LAST_UPDATED < cacheDate || useSteam || LAST_UPDATED === null) { // Only use cached values if not using STEAM.
		USER_OWN_DATA = JSON.parse('{"whitelistusers":[]}');
		USER_WISH_DATA = JSON.parse('{"whitelistusers":[]}');
	} else {
		if (user_own_data) {
			USER_OWN_DATA = JSON.parse(user_own_data);
		} else {
			USER_OWN_DATA = JSON.parse('{"whitelistusers":[]}');
		}
		if (user_wish_data) {
			USER_WISH_DATA = JSON.parse(user_wish_data);
		} else {
			USER_WISH_DATA = JSON.parse('{"whitelistusers":[]}');
		}
	}
	
	
	apiKey = localStorage.getItem('APIKey');
	
	if(!apiKey) {
		apiKey = prompt("A Steam API Key is required to perform the lookup. Please enter your Steam API key:\n\n(You can get/generate your API key here: https://steamcommunity.com/dev/apikey)", "https://steamcommunity.com/dev/apikey");
		if(apiKey) {
			localStorage.setItem('APIKey', apiKey);
		}
	} else {
		gameTitle = null;
		totalScanned = 0;
		totalHave = 0;

		if (!useSteam) {
			appInput = prompt("Please enter the Steam app ID:\n\n(This should be just the numeric value, not the name or Steam/store URL.)", "271590");
		}

		if (appInput) {
			console.log('Scanning ' + wlCount + ' total whitelisted users for game ' + appInput);
			readAllWLPages(urlWhitelist + "/search?page=", 1);
		}
	}
}

/**
 * Preloads total whitelist count information to avoid loading pages multiple times.
 * @param {boolean} OnWLPage - Flag for running from Steam store or SteamGifts site
 */
function getWLCounts(OnWLPage) {
	var linkPosition = 0;
	var searchURL = 'href="/account/manage/whitelist/search?page=';
	if (OnWLPage) {
		// Read the whitelist page in place
		wlCount = parseInt(document.getElementsByClassName('sidebar__navigation__item__count')[0].innerHTML);
		if (wlCount<=25) {
			wlPages = 1;
		} else {
			linkPosition = document.body.innerHTML.lastIndexOf(searchURL) + searchURL.length;
			wlPages = document.body.innerHTML.slice(linkPosition, document.body.innerHTML.indexOf('"',linkPosition-1));
		}
	} else {
		// Load the whitelist page and read from xml data
		var link = urlWhitelist;
		console.log('Checking WL page [' + link + '] for user count.');
		GM_xmlhttpRequest({
			method: "GET",
			url: link,
			onload: function(response) {
				if (response){
					var tempElem = document.createElement("div");
					tempElem.style.display = "none";
					tempElem.innerHTML = response.responseText;
					//console.log(tempElem.getElementsByClassName('sidebar__navigation__item__count')[0].innerHTML);
					wlCount = parseInt(tempElem.getElementsByClassName('sidebar__navigation__item__count')[0].innerHTML);
					if (wlCount<=25) {
						wlPages = 1;
					} else {
						linkPosition = tempElem.innerHTML.lastIndexOf(searchURL) + searchURL.length;
						wlPages = tempElem.innerHTML.slice(linkPosition, tempElem.innerHTML.indexOf('"',linkPosition-1));
					}
				} else {
					console.log('Error loading WL page...');
				}
			}
		});
	}
}

/**
 * Reads Steam API for game details (game title)
 * @param {Number} appID - Steam game ID to check ownership of
 */
function importJSONSteamGameDetail(appID) {
	var link = "http://store.steampowered.com/api/appdetails?appids="+appID;
	console.log('Checking store page [' + link + '] for game details.');
	var jsonFile;
	GM_xmlhttpRequest ({
		method: "GET",
		url: link,
		timeout: 5000,
		onload: function(response) {
			if (response){
				try{
					jsonFile = JSON.parse(response.responseText);
				}catch(e){
					var badAPIMsg = "Unexpected token < in JSON";
					console.log("Uncaught error: " + e.name + " -- " + e.message);
				}
				if (jsonFile) {
					gameTitle = jsonFile[appID.toString()].data.name;
				}
			}
		},
	});
}

/**
 * Reads Steam API for user details (listing of all games, plus extra info). Writes result to main user data for caching to prevent future API calls. Also sends result to count summary for final output.
 * @param {Number} steamID - Steam user ID to check ownership
 * @param {Number} appID - Steam game ID to check ownership of
 */
function importJSONSteamUserDetail(steamID, appID) {
    'use strict';
    if (apiKey) {
        var link = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" + apiKey + '&input_json={"steamid":' + steamID + '}';
		//console.log(link);
        var jsonFile;
        GM_xmlhttpRequest ({
            method: "GET",
            url: link,
            timeout: 5000,
            onload: function(response) {
                if (response){
                    try{
                        jsonFile = JSON.parse(response.responseText);
                    }catch(e){
						if (apiKey) {
							var badAPIMsg = "Unexpected token < in JSON";
							if (e.name == 'SyntaxError' && e.message.slice(0,badAPIMsg.length) == badAPIMsg) {
								// Clear API values to prevent more calls to API. Some will still get through, so hold off on alerting user until after process done.
								processCount(2);
								console.log('Data error, likely bad API key.');
								localStorage.removeItem('APIKey');
								apiKey = null;
							} else {
								console.log("Uncaught error: " + e.name + " -- " + e.message);
							}
						}
                    }
					if (jsonFile) {
						addUserToJSON(JSON.parse(response.responseText), steamID);
						readStoredOwnershipData(steamID, appID);
						/*if (findGameInJSON(JSON.parse(response.responseText),appID)) {
							processCount(1);
							//Has game
						} else {
							processCount(0);
							//Does not have game
						}*/
					}
				}
            },
        });
    } else { processCount(2);}
}

/**
 * Reads Steam API for user details (listing of all games, plus extra info). Does not write result to main user data for caching. Sends result to count summary for final output. This will likely be removed in a future update, currently never used/called.
 * @param {Number} steamID - Steam user ID to check ownership
 * @param {Number} appID - Steam game ID to check ownership of
 */
function importJSONSteamUserDetailSingleGame(steamID, appids_filter) {
    'use strict';
    if (apiKey) {
        var int_appids_filter = turnToIntArray(appids_filter);
        var link = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" + apiKey + '&input_json={"steamid":' + steamID + ',"appids_filter":' + JSON.stringify(int_appids_filter) + "}";
		//console.log(link);
        var jsonFile;
        GM_xmlhttpRequest ({
            method: "GET",
            url: link,
            timeout: 5000,
            onload: function(response) {
                if (response){
                    try{
                        jsonFile = JSON.parse(response.responseText);
                    }catch(e){
						if (apiKey) {
							var badAPIMsg = "Unexpected token < in JSON";
							if (e.name == 'SyntaxError' && e.message.slice(0,badAPIMsg.length) == badAPIMsg) {
								// Clear API values to prevent more calls to API. Some will still get through, so hold off on alerting user until after process done.
								processCount(2);
								localStorage.removeItem('APIKey');
								apiKey = null;
							} else {
								console.log("Uncaught error: " + e.name + " -- " + e.message);
							}
						}
                    }
					if (jsonFile) {
						if (jsonFile.response.game_count > 0) {
							processCount(1);
							//Has game
						} else {
							processCount(0);
							//Does not have game
						}
					}
				}
            },
        });
    } else { processCount(2);}
}

/**
 * Takes array of integers in string form and changes them to a parsed integer.
 * @param {Number} oldArray - Array with string values to change to integers
 * @return {Number} newArray - Copy of original array with integer values
 */
function turnToIntArray(oldArray) {
    var newArray = [];
    for (var i = 0; i < oldArray.length; i++) {
        newArray.push(parseInt(oldArray[i]));
    }
    return newArray;
}

/**
 * Gets user header info (steamID) from whitelist and initiates process for confirming whether or not the game is owned by that user after checking if their data is already stored in cache.
 * @param {Object} row - Div element from whitelist that holds user data
 * @param {Number} appID - Steam game ID to check ownership of
 */
function checkHasGame(row, appID) {
    GM_xmlhttpRequest({
        method: "GET",
        url: 'https://www.steamgifts.com/user/' + row.getElementsByClassName('table__column__heading')[0].innerHTML,
        onload: function(response) {
            var tempElem = document.createElement("div");
            tempElem.style.display = "none";
            tempElem.innerHTML = response.responseText;
			var steamIDdivhtml = tempElem.getElementsByClassName("sidebar__shortcut-inner-wrap")[0].innerHTML;
			var searchString1 = 'href="http://steamcommunity.com/profiles/';
			var searchString2 = '" data-tooltip=';
            var steamID = steamIDdivhtml.slice(steamIDdivhtml.indexOf(searchString1)+searchString1.length,steamIDdivhtml.indexOf(searchString2));
			if (!gameTitle) {
				importJSONSteamGameDetail(appID);
			}
            if (steamID.length > 0) {
				console.log('Checking stored data for ' + steamID);
				var haveUser = false;
				for (var i = 0; i < USER_OWN_DATA.whitelistusers.length; i++) {
					if (USER_OWN_DATA.whitelistusers[i].userID == steamID) {
						haveUser = true;
						break;
					}
				}
				if (!haveUser) {
					console.log('Do not have user stored - checking API data for ' + steamID);
					importJSONSteamUserDetail(steamID, appID);
				} else {
					console.log('Already have user stored for ' + steamID + '. Not checking API.');
					readStoredOwnershipData(steamID, appID);
				}
			}
			if (useSteam) {
				inventoryDiv.innerHTML = "<span>Checking inventories: " + (100*totalScanned/wlCount).toFixed(1) + "%</span>";
			} else {
				inventoryDiv.innerHTML = "<i class='fa fa-arrow-circle-right'></i> Checking inventories: " + (100*totalScanned/wlCount).toFixed(1) + '%';
			}
        }
    });
}

/**
 * Updates overall count statistics for reporting at the end of the checking process.
 * @param {Number} hasGame - Ownership status with three possible values: 0 = does not have game, 1 = has game, 2 = error in checking
 */
function processCount(hasGame) {
	totalScanned += 1;
	switch (hasGame) {
        case 0:
            //Does not have game.
            break;
        case 1:
			//Has game.
			totalHave +=1;
            break;
        case 2:
			//Bad data or API Key!
            break;
	}
	console.log("Processing " + totalScanned + " out of " + wlCount + " total whitelisted users");
	if (totalScanned == wlCount) {
		wrapUp();
	}
}

/**
* Finalize data, output, and storage.
*/
function wrapUp() {
	if (!useSteam) {
		console.log('Finishing up... writing user data to localStorage');
		localStorage.setItem(keyStorageOwnData, JSON.stringify(USER_OWN_DATA));
	} else {
		console.log('Finishing up... ran from Steam, so not writing user data to localStorage');
	}
	if (!apiKey) {
		prompt("There was a problem with the request. This is possibly due to a bad API key being provided, but it may also be something I did, instead.\n\nPlease check your API key and try again. If the problem continues, please report a bug (copy link below)!","https://github.com/Gaffi/SG-WL-Inventory/issues");
	}
	alert('Out of ' + totalScanned + ' whitelisted SteamGifts ' + (totalScanned == 1 ? 'user, ' : 'users, ') + totalHave + ' already ' + (totalHave == 1 ? 'has "' : 'have "') + gameTitle + '" (' + Number((100*totalHave/totalScanned).toFixed(2)) + '%).');
	if (useSteam) {
		inventoryDiv.innerHTML = "<span>Check SteamGifts game ownership</span>";
	} else {
		inventoryDiv.innerHTML = "<i class='fa fa-arrow-circle-right'></i> Check game ownership";
	}
}

/**
 * Reads HTML of whitelist page and returns an array of div elements, each housing one user's data.
 * @param {string} curHTML - The HTML to parse and search through for user data.
 * @return {Object} userRows - Array of div elements with user data.
 */
function getWLRows(curHTML) {
	var tempElem = document.createElement("div");
	tempElem.style.display = "none";
	tempElem.innerHTML = curHTML;
	var userRows = tempElem.getElementsByClassName("table__row-inner-wrap");
    return userRows;
}

/**
 * Recursive function reading all whitelist pages from first to last to read/process each user on the list.
 * @param {string} currentURL - The base URL for the whitelist.
 * @param {Number} currentPage - The current page to scan. This increments each iteration of the recursion until it reaches the last page.
 */
function readAllWLPages(currentURL, currentPage) {
	var newPage = parseInt(currentPage);
	var checkURL = currentURL + currentPage;
	console.log('Scanning WL [' + checkURL + '] for user list');
	GM_xmlhttpRequest({
		method: "GET",
		url: checkURL,
		onload: function(response) {
			if (response){
				var lastPage = wlPages;//getLastPageOfWL(response.responseText);
				var lastURL = currentURL + lastPage;
				if (lastPage >= currentPage) {
					console.log(currentPage + '/' + lastPage);
					if (apiKey) {
						var rows = getWLRows(response.responseText);
						var appID = appInput.split(','); // Right now, only works with single appID. Probably will stay this way.
						for (var i = 0; i < rows.length; i++) {
							checkHasGame(rows[i], appID);
						}
					}
					readAllWLPages(currentURL, newPage + 1);
				}
			} else {
				console.log('Error loading WL page...');
			}
		}
	});
}

/**
 * Reads through stored user data (preventing additional API calls) to see if a game is owned by a particular user.
 * @param {Number} steamID - Steam user ID to check ownership
 * @param {Number} appID - Steam game ID to check ownership of
 */
function readStoredOwnershipData(steamID, appID){
	var userData = findUserInJSON(USER_OWN_DATA.whitelistusers, steamID);
	if (userData) {
		//console.log(userData);
		var gameData = findGameInJSON(userData, appID);
		if (gameData) {
			console.log('User has game');
			processCount(1);
		} else {
			processCount(0);
		}
	} else {
		processCount(2);
	}
}

/**
 * Checks if user-specific info already exists in stored JSON data.
 * @param {Object} JSONArray - A parsed JSON object to search through - holds a listing of all users
 * @param {Number} steamID - Steam user ID to check ownership
 * @return {Object} returnJSON - A parsed JSON object (if not null) - that is a subset of the passed JSONArray - with user ownership list/details
 */
function findUserInJSON(JSONArray, steamID) {
	var returnJSON = null;
	console.log('Scanning stored user data for user ' + steamID);
    for (var i = 0; i < JSONArray.length; i++) {
        if (JSONArray[i].userID == steamID) {
			console.log('Found user ' + steamID + ' in stored data.');
			returnJSON = JSONArray[i].userData;
            return returnJSON;
		}
    }
	console.log('Could not find user ' + steamID + ' in stored data.');
    return null;
}

/**
 * Checks if game-specific info already exists in stored JSON data.
 * @param {Object} JSONArray - A parsed JSON object to search through - holds a listing of all games for a user
 * @param {Number} appID - Steam game ID to check ownership of
 * @return {boolean} hasGame - Result of searching for game in JSON data - true = owned, false = not owned
 */
function findGameInJSON(JSONArray, appID) {
	var canReadGames = true;
	var hasGame = false;
	try{
		console.log('Scanning ' + JSONArray.length + ' total user-owned games for ' + appID);
	}catch(e){
		canReadGames = false;
	}
	if (canReadGames) {
		for (var i = 0; i < JSONArray.length; i++) {
			if (JSONArray[i] == appID) {
				console.log('User has game');
				hasGame = true;
				return hasGame;
			}
		}
	}
	console.log('User does not have game');
    return hasGame;
}

/**
 * Adds user data from Steam API to pre-load JSON
 * @param {Object} newJSON - A parsed JSON object to add (if not already present)
 * @param {Number} steamID - Steam user ID to check ownership
 */
function addUserToJSON(newJSON, steamID) {
	console.log("Checking to see if we need to add user " + steamID + " to stored data pre-load (JSON).");
	//USER_OWN_DATA.whitelistusers.push(JSON.parse('{"userID":' + steamID + ',"userData":' + response.responseText + '}'));
	var alreadyHave = false;
	for (var i = 0; i < USER_OWN_DATA.whitelistusers.length; i++) {
		if (USER_OWN_DATA.whitelistusers[i].userID == steamID) {
			alreadyHave = true;
			console.log("We already have data for this user, so skipping...");
			break;
		}
	}
	if (!alreadyHave) {
		localStorage.setItem(keyStorageUpdated, new Date()); /** Make sure to set the updated date so we know when to do a full refresh */
		if (newJSON.response.games) {
			console.log("No data for " + steamID + ", but we have games to add. Adding to pre-load (JSON).");
			var tempJSON = JSON.parse('{"userID":' + steamID + ',"userData":[]}');
			for(var j = 0; j < newJSON.response.games.length; j++) {
				tempJSON.userData.push(newJSON.response.games[j].appid);
			}
			USER_OWN_DATA.whitelistusers.push(tempJSON);
		} else {
			console.log("No data for " + steamID + ", with no games to add (possibly private profile). Adding to pre-load (JSON).");
			USER_OWN_DATA.whitelistusers.push(JSON.parse('{"userID":' + steamID + ',"userData":[]}'));
		}
	}
}
