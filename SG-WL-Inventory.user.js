// ==UserScript==
// @name         SteamGifts Library Checker
// @namespace    https://github.com/Gaffi/SG-WL-Inventory
// @version      0.10
// @description  Scans your whitelist for a particular game to see how many on your list own it. Many props to Sighery for helping me with the API business and for creating the code I butchered to make this.
// @author       Gaffi
// icon
// @downloadURL  https://github.com/Gaffi/SG-WL-Inventory/raw/master/SG-WL-Inventory.user.js
// @updateURL    https://github.com/Gaffi/SG-WL-Inventory/raw/master/SG-WL-Inventory.meta.js
// @supportURL   https://www.steamgifts.com/discussion/HipoH/
// @match        https://www.steamgifts.com/account/manage/whitelist*
// @match 		 https://www.steamgifts.com/group/*
// @match		 http://store.steampowered.com/app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_log
// @connect      api.steampowered.com
// @connect      api.steampowered.com
// @connect      store.steampowered.com
// @connect		 www.steamgifts.com
// @connect 	 steamcommunity.com
// ==/UserScript==

var cacheVersion = 0.11;
var newJSONTemplate = JSON.parse('{"version":' + cacheVersion + ',"users":[]}');
var apiKey = null;
var appInput = null;
var totalScanned = 0;
var totalHave = 0;
var countToCheck = 0;
var userPages = 0;
var gameTitle = null;
var libraryDiv;
var urlWhitelist = 'https://www.steamgifts.com/account/manage/whitelist';
var urlGroup = 'www.steamgifts.com/group/';
var urlSteamApp = 'store.steampowered.com/app/';
var whichPage = -1; // 0 = Steam, 1 = SG Group, 2 = SG WL
var whichCheck = -1; // 0 = Own, 1 = Want (wishlist)
var startedWrapUp = false;
//var groupInput = null;
var groupIDList = [];
var userLimit = 2000;

var keyStorageUpdated = 'SG_WL_Inventory_last_updated';
var keyStorageOwnData = 'SG_WL_Inventory_user_own_data';
var keyStorageWishData = 'SG_WL_Inventory_user_wish_data';

var cacheDate = new Date();
cacheDate.setDate(new Date().getDate()-1);

//var LAST_UPDATED = localStorage.getItem(keyStorageUpdated);
var LAST_UPDATED = GM_getValue(keyStorageUpdated);
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
	//apiKey = localStorage.getItem('APIKey');
	apiKey = GM_getValue('APIKey');

	if (window.location.href.indexOf(urlSteamApp)>0) {
		GM_log('SteamGifts Library Checker Injecting Steam Store');
		whichPage = 0;
		injectInterfaceSteam();
	} else {
		if (window.location.href.indexOf(urlGroup)>0) {
			GM_log('SteamGifts Library Checker Injecting SteamGifts Group Page');
			whichPage = 1;
		} else {
			GM_log('SteamGifts Library Checker Injecting SteamGifts Whitelist Page');
			whichPage = 2;
		}
		injectDialog();
		injectDlgStyle();
		injectInterfaceSG();
	}
};

/**
 * Adds user data from Steam API to pre-load JSON
 * @param {Object} newJSON - A parsed JSON object to add (if not already present)
 * @param {Number} steamID - Steam user ID to check ownership
 */
function addUserToJSONOwnership(newJSON, steamID) {
	GM_log("Checking to see if we need to add user " + steamID + " to stored data pre-load (JSON for ownership).");
	var alreadyHave = false;
	for (var i = 0; i < USER_OWN_DATA.users.length; i++) {
		if (USER_OWN_DATA.users[i].userID == steamID) {
			alreadyHave = true;
			GM_log("We already have data for this user, so skipping...");
			break;
		}
	}
	if (!alreadyHave) {
		if (newJSON.response.games) {
			GM_log("No data for " + steamID + ", but we have games to add. Adding to pre-load (JSON for ownership).");
			var tempJSON = JSON.parse('{"userID":' + steamID + ',"userData":[]}');
			for(var j = 0; j < newJSON.response.games.length; j++) {
				tempJSON.userData.push(newJSON.response.games[j].appid);
			}
			USER_OWN_DATA.users.push(tempJSON);
		} else {
			GM_log("No data for " + steamID + ", with no games to add (possibly private profile). Adding to pre-load (JSON).");
			USER_OWN_DATA.users.push(JSON.parse('{"userID":' + steamID + ',"userData":[]}'));
		}
	}
}

/**
 * Adds user data from Steam API to pre-load JSON
 * @param {Object} wishlistHTML - Wishlist page HTML to add (if not already present)
 * @param {Number} steamID - Steam user ID to check ownership
 */
function addUserToJSONWishlist(wishlistHTML, steamID) {
	GM_log("Checking to see if we need to add user " + steamID + " to stored data pre-load (JSON for wishlist).");
	var alreadyHave = false;
	for (var i = 0; i < USER_WISH_DATA.users.length; i++) {
		if (USER_WISH_DATA.users[i].userID == steamID) {
			alreadyHave = true;
			GM_log("We already have data for this user, so skipping...");
			break;
		}
	}
	if (!alreadyHave) {
		GM_log("We do not have data for this user, so adding...");
		// First check is YOU/user running the script, second check is a normal user.
		// Steam allows sorting of your own wishlist, so the div class is different.
		var re1 = /div class="wishlistRow sortableRow" id="game_(\d+)"/g;
		var re2 = /div class="wishlistRow " id="game_(\d+)"/g;
		var result = '';
		var resultJSON = JSON.parse('{"userID":' + steamID + ',"userData":[]}');

		do {
			result = re1.exec(wishlistHTML);
			if (result) {
				resultJSON.userData.push(result[1]);
			}
		} while (result);

		do {
			result = re2.exec(wishlistHTML);
			if (result) {
				resultJSON.userData.push(result[1]);
			}
		} while (result);
		USER_WISH_DATA.users.push(resultJSON);
	}
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
			// If countToCheck = 0, then we have no whitelist, or we want to terminate the script.
			// Asnyc calls keep running, so this check appears mutliple times in the code.
			if (countToCheck > 0 ) {
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
					GM_log('Checking stored data for ' + steamID);
					var haveUser = false;
					var checkSource = null;
					switch (whichCheck) {
						case 0:
							checkSource = USER_OWN_DATA;
							break;
						case 1:
							checkSource = USER_WISH_DATA;
							break;
					}
					for (var i = 0; i < checkSource.users.length; i++) {
						if (checkSource.users[i].userID == steamID) {
							haveUser = true;
							break;
						}
					}
					if (!haveUser) {
						GM_log('Do not have user stored - checking API data for ' + steamID);
						switch (whichCheck) {
							case 0:
								checkSteamUserLibrary(steamID, appID);
								break;
							case 1:
								checkSteamUserWishlist(steamID, appID);
								break;
						}
					} else {
						GM_log('Already have user stored for ' + steamID + '. Not checking API.');
						readStoredUserData(steamID, appID);
					}
				}
			}
        }
    });
}

/**
 * Kicks off ownership checking routine.
 */
function checkOwnership() {
	if (countToCheck < 0) {
		getUserCounts();
	}
	switch (whichPage) {
		case 0: // Steam Store
				if (appInput) {
					GM_log('Scanning ' + countToCheck + ' total whitelisted users for game ' + appInput);
					readAllUserPages(urlWhitelist + "/search?page=", 1);
				}
			break;
		case 1: // SG Group Page
			if (countToCheck > userLimit) {
				GM_log('Too many users in the list. (' + countToCheck + '/' + userLimit + ') Stopping.');
				document.getElementById('SGLCdlg-output').value = 'There are more than ' + userLimit + ' users in this list. The Steam API limits how many API calls can be made at (10,000 per day), but the script likely will not work with this many users because of memory issues I have yet to work out.\n\n(FYI: The Steam user count will likely reflect a different amount than what is displayed on the SG group page. This is normal and is a result of a mix of SG user caching and Steam users not being a part of the SG site.)';
			} else if (countToCheck === 0) {
				GM_log('0 users found. Stopping.');
				document.getElementById('SGLCdlg-output').value = 'There were no users found. This is probably an error in the script, but please make sure you are on a proper group page before trying. If you think you have done everything correctly, please report this error.';
			} else {
				GM_log('Number of users in the list is good. Continuing...');
				appInput = document.getElementById('SGLCdlg-AppID').value;
				if (appInput) {
					GM_log('appInput is good: ' + appInput);
					if (!gameTitle) {
						GM_log('Getting game title...');
						importJSONSteamGameDetail(appInput);
					}
					GM_log('Scanning through ' + countToCheck + ' group users...');

					// Parse out different variations in URL for alternate group page info screens.
					// In order to check the users, we have to grab the user page specifically.
					var groupURL = '';
					var indexUsers = window.location.href.indexOf('/users');
					var indexStats = window.location.href.indexOf('/stats') ;
					var indexWishlist = window.location.href.indexOf('/wishlist') ;
					if (indexUsers > 0) {
						groupURL = window.location.href + '/search?page=';
					} else if (indexStats > 0) {
						groupURL = window.location.href.slice(0,indexStats) + '/users/search?page=';
					} else if (indexWishlist > 0) {
						groupURL = window.location.href.slice(0,indexWishlist) + '/users/search?page=';
					} else {
						groupURL = window.location.href + '/users/search?page=';
					}
					readAllUserPages(groupURL, 1);
				} else {
					GM_log('appInput is no good...');
				}
			}
			break;
		case 2: // SG WL Page
			if (countToCheck>userLimit) {
				document.getElementById('SGLCdlg-output').value = 'There are more than ' + userLimit + ' users in this list. The Steam API limits how many API calls can be made at one time, and the script likely will not work with this many users. (Steam API count may reflect a different amount than what is displayed on the SG group page.)';
			} else {
				appInput = document.getElementById('SGLCdlg-AppID').value;
				if (appInput) {
					GM_log('Scanning ' + countToCheck + ' total whitelisted users for game ' + appInput);
					readAllUserPages(urlWhitelist + "/search?page=", 1);
				}
			}
			break;
	}
}

/**
 * Reads Steam API for user details (listing of all games, plus extra info). Writes result to main user data for caching to prevent future API calls. Also sends result to count summary for final output.
 * @param {Number} steamID - Steam user ID to check ownership
 * @param {Number} appID - Steam game ID to check ownership of
 */
function checkSteamUserLibrary(steamID, appID) {
    // If countToCheck = 0, then we have no whitelist, or we want to terminate the script.
	// Asnyc calls keep running, so this check appears mutliple times in the code.
	// apiKey check here plays a similar role.
    if (apiKey && countToCheck > 0 && steamID) {
        var link = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" + apiKey + '&input_json={"steamid":' + steamID + '}';
		//GM_log(link);
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
						if (e.name == 'SyntaxError' && e.message.slice(0,badAPIMsg.length) == badAPIMsg) {
							// Clear API values to prevent more calls to API.
							processCount(2);
							GM_log('Error loading user JSON!');
							//localStorage.removeItem('APIKey');
							apiKey = null;
						} else {
							GM_log("Uncaught error: " + e.name + " -- " + e.message);
						}
                    }
					if (jsonFile) {
						addUserToJSONOwnership(JSON.parse(response.responseText), steamID);
						readStoredUserData(steamID, appID);
					}
				}
            },
        });
	}
}

/**
 * Reads Steam wishist page (NO API CALL FOR THIS. THIS MAY BE VERY SLOW...)
 * Writes result to main user data for caching to prevent future API calls.
 * Also sends result to count summary for final output.
 * @param {Number} steamID - Steam user ID to check wishlist status
 * @param {Number} appID - Steam game ID to check
 */
function checkSteamUserWishlist(steamID, appID) {
    if (steamID && appID) {
        var link = 'http://steamcommunity.com/profiles/' + steamID + '/wishlist';
        GM_xmlhttpRequest({
			method: "GET",
			url: link,
			onload: function(response) {
				if (response){
					if (response.responseText) {
						addUserToJSONWishlist(response.responseText, steamID);
						readStoredUserData(steamID, appID);
					} else {
						GM_log('Error loading wishlist page (probably private user)...');
						addUserToJSONWishlist("", steamID);
						readStoredUserData(steamID, appID);
					}
				} else {
					GM_log('Error loading wishlist page...');
					processCount(2);
				}
			}
		});
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
	GM_log('Scanning stored user data for user ' + steamID);
    for (var i = 0; i < JSONArray.length; i++) {
        if (JSONArray[i].userID == steamID) {
			GM_log('Found user ' + steamID + ' in stored data.');
			returnJSON = JSONArray[i].userData;
            return returnJSON;
		}
    }
	GM_log('Could not find user ' + steamID + ' in stored data.');
    return null;
}

/**
 * Checks if game-specific info already exists in stored JSON data.
 * @param {Object} JSONArray - A parsed JSON object to search through - holds a listing of all games for a user
 * @param {Number} appID - Steam game ID to check ownership of
 * @return {boolean} hasGame - Result of searching for game in JSON data - true = owned, false = not owned
 */
function findGameInJSON(JSONArray, appID, steamID) {
	var canReadGames = true;
	var hasGame = false;
	try{
		GM_log('Scanning ' + JSONArray.length + ' total saved user games for ' + appID);
	}catch(e){
		canReadGames = false;
	}
	if (canReadGames) {
		for (var i = 0; i < JSONArray.length; i++) {
			if (JSONArray[i] == appID) {
				hasGame = true;
				return hasGame;
			}
		}
	}
    return hasGame;
}

/**
 * Preloads total whitelist/group count information to avoid loading pages multiple times.
 * Pre-loading also prevents asnyc calls to hit before counts are obtained.
 */
function getUserCounts() {
	countToCheck = 0;
	var link = '';
	switch(whichPage) {
		case 0:
			// Load the whitelist page and read from xml data
			GM_log('Getting user counts for WL page from Steam Store...');
			link = urlWhitelist + '/search?page=1000';
			GM_log('Checking WL page [' + link + '] for user count.');
			GM_xmlhttpRequest({
				method: "GET",
				url: link,
				onload: function(response) {
					if (response){
						var tempElem = document.createElement("div");
						tempElem.style.display = "none";
						tempElem.innerHTML = response.responseText;
						countToCheck = parseInt(tempElem.getElementsByClassName('sidebar__navigation__item__count')[0].innerHTML.replace(/\,/g,''));
					} else {
						GM_log('Error loading WL page...');
					}
				}
			});
			break;
		case 1:
			// Load the user page and get the user/page count.
			GM_log('Getting user counts from main group page from SG...');
			countToCheck = parseInt(document.getElementsByClassName('sidebar__navigation__item__count')[1].innerHTML.replace(/\,/g,''));
			break;
		case 2:
			// Read the whitelist page in place
			GM_log('Getting user counts for WL page from SG...');
			countToCheck = parseInt(document.getElementsByClassName('sidebar__navigation__item__count')[0].innerHTML.replace(/\,/g,''));
			break;
	}
	GM_log('Setting user pages for ' + countToCheck + ' users (' + Math.ceil(countToCheck/25) + ').');
	userPages = Math.ceil(countToCheck/25);
}

/**
 * Reads HTML of whitelist/group page and returns an array of div elements, each housing one user's data.
 * @param {string} curHTML - The HTML to parse and search through for user data.
 * @return {Object} userRows - Array of div elements with user data.
 */
function getUserRows(curHTML) {
	var tempElem = document.createElement("div");
	tempElem.style.display = "none";
	tempElem.innerHTML = curHTML;
	var userRows = tempElem.getElementsByClassName("table__row-inner-wrap");
    return userRows;
}

/**
 * Reads Steam API for game details (game title)
 * @param {Number} appID - Steam game ID to check ownership of
 */
function importJSONSteamGameDetail(appID) {
	var link = "http://store.steampowered.com/api/appdetails?appids="+appID;
	GM_log('Checking store page [' + link + '] for game details.');
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
					GM_log("Uncaught error: " + e.name + " -- " + e.message);
				}
				//GM_log(jsonFile);
				if (jsonFile[appID.toString()].success) {
					gameTitle = jsonFile[appID.toString()].data.name;
					GM_log('Game Title: ' + gameTitle);
					if (whichPage > 0 && document.getElementById('SGLCdlg-GameName').value.length === 0) {
						document.getElementById('SGLCdlg-GameName').value = gameTitle;
					}
				} else {
					countToCheck = -1;
					totalScanned = 0;
				}
			}
		},
	});
}

/**
 * Adds hidden display to SteamGifts to review results/kickoff checking process
 * Shamelessly stolen from Sighery's RaCharts Enhancer script
 */
function injectDialog() {
    var dlg = document.createElement('div');
    dlg.setAttribute('id', 'black-background');
	var dlgMainDiv = document.createElement('div');
    dlg.appendChild(dlgMainDiv);
    document.body.insertBefore(dlg, document.body.children[0]);

    dlgMainDiv.setAttribute('id', 'SGLCdlg');
	var dlgHeader = document.createElement('div');
    dlgMainDiv.appendChild(dlgHeader);

    dlgHeader.setAttribute('id', 'SGLCdlg-header');
	var dlgHdrSecDiv = document.createElement('div');
    dlgHeader.appendChild(dlgHdrSecDiv);
    dlgHdrSecDiv.setAttribute('id', 'SGLCdlg-header-title');
    dlgHdrSecDiv.innerHTML = "Gaffi's SteamGifts Library Checker";

	var dlgHdrBttn = document.createElement('button');
    dlgHeader.appendChild(dlgHdrBttn);
    dlgHdrBttn.setAttribute('id', 'closeSGLC');

	dlgHdrBttn.addEventListener('click', function() {
        var blackbg = document.getElementById('black-background');
        var dlg = document.getElementById('SGLCdlg');

        blackbg.style.display = 'none';
        dlg.style.display = 'none';
    });

	var dlgHdrBttnI = document.createElement('i');
    dlgHdrBttn.appendChild(dlgHdrBttnI);
    dlgHdrBttnI.setAttribute('class', 'fa fa-times');
    dlgHdrBttnI.style.fontSize = "25px";
    dlgHdrBttnI.style.marginTop = "-6px";


	var dlgBody = document.createElement('div');
    dlgMainDiv.appendChild(dlgBody);
    dlgBody.setAttribute('id', 'SGLCdlg-body');

    var dlgTable = document.createElement('table');
	dlgTable.setAttribute('style', 'width: 100%');

    var rowAPIKey = dlgTable.insertRow(0);
    var rowAPIKeyLabel = rowAPIKey.insertCell(0);
	var rowAPIKeyValue = rowAPIKey.insertCell(1);
	var rowAppID = dlgTable.insertRow(1);
    var rowAppIDLabel = rowAppID.insertCell(0);
	var rowAppIDValue = rowAppID.insertCell(1);
	var rowGameName = dlgTable.insertRow(2);
    var rowGameNameLabel = rowGameName.insertCell(0);
	var rowGameNameResult = rowGameName.insertCell(1);
	var rowButtons = dlgTable.insertRow(3);
    var rowButtonsCheck = rowButtons.insertCell(0);
	var rowButtonsProgress = rowButtons.insertCell(1);

	dlgBody.appendChild(dlgTable);

	var dlgAPILab = document.createElement('label');
    rowAPIKeyLabel.appendChild(dlgAPILab);
    dlgAPILab.htmlFor = "APIKey";
    dlgAPILab.innerHTML = "API Key:";
	var dlgAPIInput = document.createElement('input');
    rowAPIKeyValue.appendChild(dlgAPIInput);
    dlgAPIInput.type = "textarea";
    dlgAPIInput.setAttribute('id', 'SGLCdlg-APIKey');
	dlgAPIInput.setAttribute('class', 'SGLCdlg-input-enabled input');
	dlgAPIInput.value = apiKey;

	var dlgAppIDLab = document.createElement('label');
    rowAppIDLabel.appendChild(dlgAppIDLab);
    dlgAppIDLab.htmlFor = "SGLCdlg-AppID";
    dlgAppIDLab.innerHTML = "App ID:";
	var dlgAppIDInput = document.createElement('input');
    rowAppIDValue.appendChild(dlgAppIDInput);
    dlgAppIDInput.type = "textarea";
    dlgAppIDInput.setAttribute('id', 'SGLCdlg-AppID');
	dlgAppIDInput.setAttribute('class', 'SGLCdlg-input-enabled');

	var dlgGameNameLab = document.createElement('label');
    rowGameNameLabel.appendChild(dlgGameNameLab);
    dlgGameNameLab.htmlFor = "SGLCdlg-GameName";
    dlgGameNameLab.innerHTML = "Game Name:";
	var dlgGameNameResult = document.createElement('input');
    rowGameNameResult.appendChild(dlgGameNameResult);
    dlgGameNameResult.type = "textarea";
	dlgGameNameResult.readOnly = true;
	dlgGameNameResult.setAttribute('class', 'SGLCdlg-input-disabled input');
    dlgGameNameResult.setAttribute('id', 'SGLCdlg-GameName');

	var dlgCheckBttnOwn = document.createElement('button');
    dlgBody.appendChild(dlgCheckBttnOwn);
	dlgCheckBttnOwn.setAttribute('id', 'SGLCdlg-checkbuttonown');
    dlgCheckBttnOwn.setAttribute('class', 'SGLCdlg-button');
	dlgCheckBttnOwn.setAttribute('style', 'float:left;');
    dlgCheckBttnOwn.innerHTML = "Check library";
	dlgCheckBttnOwn.addEventListener('click', function() {
        var input = document.getElementById('SGLCdlg-APIKey');
        //localStorage.setItem(input.id, input.value);
		GM_setValue(input.id, input.value);
		dlgGameNameResult.value = null;
		dlgOutputTxt.value = null;
		if(document.getElementById('SGLCdlg-AppID').value.length ===  0) {
			document.getElementById('SGLCdlg-output').value = 'Please enter a valid app ID...';
		} else {
			whichCheck = 0;
			switch (whichPage) {
				case 1:
					document.getElementById('SGLCdlg-output').value = 'Checking group users...';
					break;
				case 2:
					document.getElementById('SGLCdlg-output').value = 'Checking whitelisted users...';
					break;
			}
			if (whichCheck == 1) {
				document.getElementById('SGLCdlg-output').value = document.getElementById('SGLCdlg-output').value + '\n\nIf this data has not been cached yet, this may take a few minutes, depending on the size of the userlist. Please be patient.';
			}
			document.getElementById('SGLCdlg-checkbuttonown').disabled = true;
			document.getElementById('SGLCdlg-checkbuttonwant').disabled = true;
			document.getElementById('SGLCdlg-cachebutton').disabled = true;
			startCheck();
		}
    });
	rowButtonsCheck.appendChild(dlgCheckBttnOwn);

	var dlgCheckBttnWant = document.createElement('button');
    dlgBody.appendChild(dlgCheckBttnWant);
	dlgCheckBttnWant.setAttribute('id', 'SGLCdlg-checkbuttonwant');
    dlgCheckBttnWant.setAttribute('class', 'SGLCdlg-button');
	dlgCheckBttnWant.setAttribute('style', 'float:left;');
    dlgCheckBttnWant.innerHTML = "Check wishlist";
	dlgCheckBttnWant.addEventListener('click', function() {
        var input = document.getElementById('SGLCdlg-APIKey');
        //localStorage.setItem(input.id, input.value);
		GM_setValue(input.id, input.value);
		dlgGameNameResult.value = null;
		dlgOutputTxt.value = null;
		if(document.getElementById('SGLCdlg-AppID').value.length ===  0) {
			document.getElementById('SGLCdlg-output').value = 'Please enter a valid app ID...';
		} else {
			whichCheck = 1;
			switch (whichPage) {
				case 1:
					document.getElementById('SGLCdlg-output').value = 'Checking group users...';
					break;
				case 2:
					document.getElementById('SGLCdlg-output').value = 'Checking whitelisted users...';
					break;
			}
			document.getElementById('SGLCdlg-checkbuttonown').disabled = true;
			document.getElementById('SGLCdlg-checkbuttonwant').disabled = true;
			document.getElementById('SGLCdlg-cachebutton').disabled = true;
			startCheck();
		}
    });
	rowButtonsCheck.appendChild(dlgCheckBttnWant);

	var dlgProgress = document.createElement('button');
    dlgBody.appendChild(dlgProgress);
    dlgProgress.setAttribute('id', 'SGLCdlg-progress');
	dlgProgress.setAttribute('class', 'SGLCdlg-button');
	dlgProgress.setAttribute('style','display:none;float:right;');
    dlgProgress.innerHTML = "";
	rowButtonsProgress.appendChild(dlgProgress);

	dlgBody.appendChild(document.createElement('br'));

	var dlgOutputTxt = document.createElement('textarea');
	dlgOutputTxt.readOnly = true;
	dlgOutputTxt.setAttribute('rows','10');
	dlgOutputTxt.setAttribute('cols','50');
	dlgOutputTxt.setAttribute('id', 'SGLCdlg-output');
	dlgOutputTxt.value = '';
	dlgBody.appendChild(dlgOutputTxt);

	dlgBody.appendChild(document.createElement('br'));

	var dlgCacheBttn = document.createElement('button');
    dlgBody.appendChild(dlgCacheBttn);
	dlgCacheBttn.setAttribute('id', 'SGLCdlg-cachebutton');
    dlgCacheBttn.setAttribute('class', 'SGLCdlg-button');
	dlgCacheBttn.setAttribute('style', 'float:left;');
    dlgCacheBttn.innerHTML = "Reset Cache";
	dlgCacheBttn.addEventListener('click', function() {
        var input = document.getElementById('SGLCdlg-APIKey');
		GM_removeValue(keyStorageOwnData);
		GM_removeValue(keyStorageWishData);
        //localStorage.removeItem(keyStorageOwnData);
		//localStorage.removeItem(keyStorageWishData);
    });

	dlgBody.appendChild(document.createElement('br'));

	var dlgInfo = document.createElement('h2');
    dlgBody.appendChild(dlgInfo);
    dlgInfo.style.float = "right";
	var dlgInfoA = document.createElement('a');
    dlgInfo.appendChild(dlgInfoA);
    dlgInfoA.href = "https://www.steamgifts.com/discussion/HipoH/";
    dlgInfoA.style.color = "#FFFFFF";
    dlgInfoA.style.fontSize = "20px";
    dlgInfoA.style.fontStyle = "italic";
    dlgInfoA.style.textDecoration = "underline";
    dlgInfoA.innerHTML = "Info";

	dlgBody.appendChild(document.createElement('br'));

}

/**
 * Adds styles to SteamGifts to review results
 * Shamelessly stolen from Sighery's RaCharts Enhancer script
 */
function injectDlgStyle() {
    var dialogCSS = [
            "#black-background {",
            "  display: none;",
            "  width: 100%;",
            "  height: 100%;",
            "  position: fixed;",
            "  top: 0px;",
            "  left: 0px;",
            "  background-color: rgba(0, 0, 0, 0.75);",
            "  z-index: 8888;",
            "}",
            "#SGLCdlg{",
            "  display: none;",
            "  position: fixed;",
            "  width: 500px;",
            "  z-index: 9999;",
            "  border-radius: 10px;",
            "  background-color: #7c7d7e;",
            "}",
            "#SGLCdlg-header {",
            "  background-color: #6D84B4;",
            "  padding: 10px;",
            "  padding-bottom: 30px;",
            "  margin: 10px 10px 10px 10px;",
            "  color: white;",
            "  font-size: 20px;",
            "}",
            "#SGLCdlg-header-title {",
            "  float: left;",
            "}",
            "#SGLCdlg-body{",
            "  clear: both;",
            "  background-color: #C3C3C3;",
            "  color: white;",
            "  font-size: 14px;",
            "  padding: 10px;",
            "  margin: 0px 10px 10px 10px;",
            "}",
            "#closeSGLC {",
            "  background-color: transparent;",
            "  color: white;",
            "  float: right;",
            "  border: none;",
            "  font-size: 25px;",
            "  margin-top: -5px;",
            "  opacity: 0.7;",
            "}",
            ".SGLCdlg-button{",
            "  background-color: #fff;",
            "  border: 2px solid #333;",
            "  box-shadow: 1px 1px 0 #333,",
            "              2px 2px 0 #333,",
            "              3px 3px 0 #333,",
            "              4px 4px 0 #333,",
            "              5px 5px 0 #333;",
            "  color: #333;",
            "  display: inline-block;",
            "  padding: 4px 6px;",
            "  position: relative;",
            "  text-decoration: none;",
            "  text-transform: uppercase;",
            "  -webkit-transition: .1s;",
            "     -moz-transition: .1s;",
            "      -ms-transition: .1s;",
            "       -o-transition: .1s;",
            "          transition: .1s;",
            "}",
            ".SGLCdlg-button:hover,",
            ".SGLCdlg-button:focus {",
            "  background-color: #edd;",
            "}",
			".SGLCdlg-button:disabled {",
			"opacity: 0.65;",
			"cursor: not-allowed;",
			"}",
            ".SGLCdlg-button:active {",
            "  box-shadow: 1px 1px 0 #333;",
            "  left: 4px;",
            "  top: 4px;",
            "}",
			".SGLCdlg-input-disabled {",
			"  background-color: #ddd !important;",
			"  float: right;",
			"  margin-left: 35px;",
			"  width: 200px;",
			"  line-height: inherit !important;",
			"}",
			".SGLCdlg-input-enabled {",
			"  float: right;",
			"  margin-left: 35px;",
			"  width: 200px;",
			"  line-height: inherit !important;",
			"}"
    ].join("\n");
    var node = document.createElement('style');
    node.type = "text/css";
    node.appendChild(document.createTextNode(dialogCSS));
    document.getElementsByTagName('head')[0].appendChild(node);
}

/**
 * Adds button to Steam store to run checking process
 * Button placement taken from VonRaven at https://www.steamgifts.com/go/comment/MU3ojjL, http://pastebin.com/kRKv53uv
 */
function injectInterfaceSteam() {
    var refTarget, refParent;
    refTarget = document.getElementsByClassName('apphub_AppName')[0];
    refParent = document.getElementsByClassName('apphub_HeaderStandardTop')[0];

	GM_log('Creating button/progress bar on Steam store...');
	libraryDiv = document.createElement("DIV");
    libraryDiv.id = "whitelist_ownership_checker";
    libraryDiv.className = 'btnv6_blue_hoverfade btn_medium';
    libraryDiv.innerHTML = "<span>SG Check</span>";

	var libraryExtraDiv = document.createElement("DIV");
	libraryExtraDiv.className = 'apphub_OtherSiteInfo';
	libraryExtraDiv.style = 'margin-right:0.2em';
	libraryExtraDiv.appendChild(libraryDiv);
	refParent.insertBefore(libraryExtraDiv, refTarget);
	document.getElementById('whitelist_ownership_checker').addEventListener('click', startCheck, false);

	var curURL = window.location.href;
	if (curURL.lastIndexOf('/')+1 != curURL.length) {
		curURL += '/';
	}
	appInput = curURL.slice(curURL.lastIndexOf('/',curURL.length-2)+1,curURL.lastIndexOf('/',curURL.length));
	getUserCounts();
	GM_log('Library checking button loaded without errors.');
}

/**
 * Adds button to SteamGifts whitelist/group page to run checking process
 */
function injectInterfaceSG() {
	var bFound=0;
    var i=0;
    var refTarget;
	var searchElement = '';
	var searchHTML = '';
	switch (whichPage) {
		case 1:
			searchElement = 'sidebar__shortcut-inner-wrap';
			searchHTML = 'data-tooltip="Visit Steam Group"><i class="fa fa-fw fa-steam"></i></a>';
			break;
		case 2:
			searchElement = 'page__heading__breadcrumbs';
			searchHTML = '<a href="/account">Account</a><i class="fa fa-angle-right"></i><a href="/account/manage/whitelist">Whitelist</a>';
			break;
	}

    while(bFound===0) {
		refTarget = document.getElementsByClassName(searchElement)[i];
		if (refTarget.innerHTML.indexOf(searchHTML) >= 0) {
			bFound = 1;
		} else i++;
    }

	GM_log('Creating button/progress bar on SteamGifts...');
	libraryDiv = document.createElement("DIV");
	libraryDiv.id = "whitelist_ownership_checker";
	switch (whichPage) {
		case 1:
			// Create button on left-hand navigation panel of group page.
			libraryDiv.className = 'sidebar__shortcut-inner-wrap';
			libraryDiv.innerHTML = "<span><i class='fa fa-arrow-circle-right'></i> Check game ownership</span>";
			break;
		case 2:
			// Create button at top of WL page
			libraryDiv.className = 'form__submit-button';
			libraryDiv.innerHTML = "<span><i class='fa fa-arrow-circle-right'></i> Check game ownership</span>";
			break;
	}
	getUserCounts();

    refTarget.parentNode.appendChild(libraryDiv);

	libraryDiv.addEventListener('click', function() {
		var blackbg = document.getElementById('black-background');
		var dlg = document.getElementById('SGLCdlg');
		blackbg.style.display = 'block';
		dlg.style.display = 'block';

		var winWidth = window.innerWidth;
		var winHeight = window.innerHeight;

		dlg.style.left = (winWidth/2) - 500/2 + 'px';
		dlg.style.top = '150px';
	});

	GM_log('Library checking button loaded without errors.');
}

/**
 * Updates overall count statistics for reporting at the end of the checking process.
 * @param {Number} hasGame - Ownership status with three possible values: 0 = does not have game, 1 = has game, 2 = error in checking
 */
function processCount(hasGame) {
	// If countToCheck = 0, then we have no whitelist, or we want to terminate the script.
	// Asnyc calls keep running, so this check appears mutliple times in the code.
	if (countToCheck > 0) {
		totalScanned += 1;
		GM_log("Processing " + totalScanned + " out of " + countToCheck + " total users");
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
	}

	if (whichPage === 0) {
		libraryDiv.innerHTML = "<span>Checking libraries: " + (100*totalScanned/countToCheck).toFixed(1) + "%</span>";
	} else {
		var dlgProgress = document.getElementById('SGLCdlg-progress');
		dlgProgress.setAttribute('style','display:block;float:right;');
		if (whichCheck === 0) {
			dlgProgress.innerHTML = "<span><i class='fa fa-arrow-circle-right'></i> Checking libraries: " + (100*totalScanned/countToCheck).toFixed(1) + '%</span>';
		} else {
			dlgProgress.innerHTML = "<span><i class='fa fa-arrow-circle-right'></i> Checking wishlists: " + (100*totalScanned/countToCheck).toFixed(1) + '%</span>';
		}
	}

	if (totalScanned >= countToCheck) {
		GM_log('Wrapping up... If this is an early termination, async calls may post multiple times.');
		wrapUp();
	}
}

/**
 * Recursive function reading all whitelist/group pages from first to last to read/process each user on the list.
 * @param {string} currentURL - The base URL for the whitelist.
 * @param {Number} currentPage - The current page to scan. This increments each iteration of the recursion until it reaches the last page.
 */
function readAllUserPages(currentURL, currentPage) {
	// If countToCheck = 0, then we have no whitelist, or we want to terminate the script.
	// Asnyc calls keep running, so this check appears mutliple times in the code.
	if (countToCheck > 0) {
		var newPage = parseInt(currentPage);
		var checkURL = currentURL + currentPage;
		GM_log('Scanning user list [' + checkURL + '] for users...');
		GM_xmlhttpRequest({
			method: "GET",
			url: checkURL,
			onload: function(response) {
				if (response){
					var lastPage = userPages;
					var lastURL = currentURL + lastPage;
					GM_log('Good response on XML load for page ' + currentPage + ' of ' + lastPage + '.');
					if (lastPage >= currentPage) {
						GM_log(currentPage + '/' + lastPage);
						if (apiKey) {
							var rows = getUserRows(response.responseText);
							var appID = appInput.split(','); // Right now, only works with single appID. Probably will stay this way.
							for (var i = 0; i < rows.length; i++) {
								checkHasGame(rows[i], appID);
							}
						}
						GM_log('User page loaded. Reading user data...');
						readAllUserPages(currentURL, newPage + 1);
					}
				} else {
					GM_log('Error loading WL page...');
				}
			}
		});
	}
}

/**
 * Reads through stored user data (preventing additional API calls) to see if a game is owned by a particular user.
 * @param {Number} steamID - Steam user ID to check ownership
 * @param {Number} appID - Steam game ID to check ownership of
 */
function readStoredUserData(steamID, appID){
	var userData = null;
	var userVerb = '';
	if (whichCheck === 0) {
		userData = findUserInJSON(USER_OWN_DATA.users, steamID);
		userVerb = ' owns ';
	} else {
		userData = findUserInJSON(USER_WISH_DATA.users, steamID);
		userVerb = ' wants ';
	}

	if (userData) {
		if (findGameInJSON(userData, appID, steamID)) {
			GM_log('User ' + steamID + userVerb + 'game ' + appID + ' = True');
			processCount(1);
		} else {
			GM_log('User ' + steamID + userVerb + 'game ' + appID + ' = False');
			processCount(0);
		}
	} else {
		processCount(2);
	}
}

/**
 * Kicks off checking routine, choosing between group and whitelist modes.
 */
function startCheck() {
	startedWrapUp = false;
	//var user_own_data = localStorage.getItem(keyStorageOwnData);
	var user_own_data = GM_getValue(keyStorageOwnData);
	//var user_wish_data = localStorage.getItem(keyStorageWishData);
	var user_wish_data = GM_getValue(keyStorageWishData);

	// Only use cached values if not using Steam.
	if (whichPage > 0) {
		GM_log('Not on Steam page, using cache.');
		GM_log('SG User Data Last updated: ' + LAST_UPDATED + ' - Needs to be updated if last updated before: ' + cacheDate);
		var USER_TEMP_DATA = null;
		var user_temp_data = null;
		if (Date.parse(LAST_UPDATED) < Date.parse(cacheDate) || LAST_UPDATED === null) {
			GM_log('Past update date, creating new cache.');
			USER_TEMP_DATA = newJSONTemplate;
		} else {
			GM_log('Not past update date, checking previous cache.');
			switch (whichCheck) {
				case 0:
					user_temp_data = user_own_data;
					break;
				case 1:
					user_temp_data = user_wish_data;
					break;
			}

			GM_log('Checking for user cache...');
			if (user_temp_data) {
				GM_log('Cache exists.');
				USER_TEMP_DATA = JSON.parse(user_temp_data);
				if (USER_TEMP_DATA.version != cacheVersion) {
					GM_log('Cache version update. Resetting...');
					USER_TEMP_DATA = newJSONTemplate;
				}
			} else {
				GM_log('Cache does not exist. Creating new...');
				USER_TEMP_DATA = newJSONTemplate;
			}
		}
		switch (whichCheck) {
			case 0:
				USER_OWN_DATA = USER_TEMP_DATA;
				break;
			case 1:
				USER_WISH_DATA = USER_TEMP_DATA;
				break;
		}
	}

	if(!apiKey) {
		GM_log('API Key is no good.');
		if (whichPage > 0) {
			apiKey = document.getElementById('SGLCdlg-APIKey').value;
		} else {
			apiKey = prompt("A Steam API Key is required to perform the lookup. Please enter your Steam API key:\n\n(You can get/generate your API key here: https://steamcommunity.com/dev/apikey)", "https://steamcommunity.com/dev/apikey");
		}
		if(apiKey) {
			//localStorage.setItem('APIKey', apiKey);
			GM_setValue('APIKey', apiKey);
		}
		document.getElementById('SGLCdlg-checkbuttonown').disabled = false;
		document.getElementById('SGLCdlg-checkbuttonwant').disabled = false;
		document.getElementById('SGLCdlg-cachebutton').disabled = false;
	} else {
		GM_log('API Key is good.');
		gameTitle = null;
		totalScanned = 0;
		totalHave = 0;

		checkOwnership();
	}
}

/**
* Finalize data, output, and storage.
*/
function wrapUp() {
	GM_log('Checking if already wrapped up...');
	if (!startedWrapUp) {
		GM_log("...Not yet, so let's do it.");
		startedWrapUp = true;
		if (whichPage > 0) {
			if ((Date.parse(LAST_UPDATED) < Date.parse(cacheDate)) || LAST_UPDATED === null) {
				/** Make sure to set the updated date so we know when to do a full refresh */
				GM_log('Setting current date as update date.');
				//localStorage.setItem(keyStorageUpdated, new Date());
				GM_setValue(keyStorageUpdated, new Date());
            }

			GM_log('Finishing up... writing cache data to cache.');
			switch (whichCheck) {
				case 0:
					try {
						GM_setValue(keyStorageOwnData, JSON.stringify(USER_OWN_DATA));
						//localStorage.setItem(keyStorageOwnData, JSON.stringify(USER_OWN_DATA));
					}
					catch(e){
						GM_log(e.message);
					}
					break;
				case 1:
					try {
						GM_setValue(keyStorageWishData, JSON.stringify(USER_WISH_DATA));
						//localStorage.setItem(keyStorageWishData, JSON.stringify(USER_WISH_DATA));
						}
					catch(e){
						GM_log(e.message);
					}
					break;
			}
		} else {
			GM_log('Finishing up... ran from Steam, so not writing user data to cache.');
		}
		if (!apiKey) {
			prompt("There was a problem with the request. This is possibly due to a bad API key being provided, but it may also be something I did, instead.\n\nPlease check your API key and try again. If the problem continues, please report a bug (copy link below)!","https://github.com/Gaffi/SG-WL-Inventory/issues");
		}

		// If countToCheck == 0, then we have no user list, or we want to terminate the script.
		// Asnyc calls keep running, so this check appears mutliple times in the code.
		if (countToCheck > 0) {
			GM_log('Good user list count, normal output.');
			if (whichPage === 0) {
				libraryDiv.innerHTML = "<span>SG♥: " + totalHave + "/" + totalScanned + " (" + Number((100*totalHave/totalScanned).toFixed(2)) + "%)</span>";
			} else {
				document.getElementById('SGLCdlg-GameName').value = gameTitle;
				document.getElementById('SGLCdlg-progress').setAttribute('style','display:none;');
				var groupType = '';
				var checkType = '';

				if (whichPage == 1) {
					groupType = 'this group';
				} else {
					groupType = 'your whitelist';
				}

				if (whichCheck === 0) {
					checkType = 'library';
				} else {
					checkType = 'wishlist';
				}

				document.getElementById('SGLCdlg-checkbuttonown').disabled = false;
				document.getElementById('SGLCdlg-checkbuttonwant').disabled = false;
				document.getElementById('SGLCdlg-cachebutton').disabled = false;

				document.getElementById('SGLCdlg-output').value = 'Out of ' + totalScanned + (totalScanned == 1 ? ' user ' : ' users ') + 'in ' + groupType + ', ' + totalHave + ' ' + (totalHave == 1 ? 'has "' : 'have "') + gameTitle + '" in their ' + checkType + ' (' + Number((100*totalHave/totalScanned).toFixed(2)) + '%).';
			}
		} else {
			GM_log('Whitelist count = 0, null output.');
			if (whichPage === 0) {
				libraryDiv.innerHTML = "<span>SG Check</span>";
			} else {
				document.getElementById('SGLCdlg-GameName').value = '<not loaded>';
				document.getElementById('SGLCdlg-progress').setAttribute('style','display:none;');
				if (countToCheck == -1) {
					document.getElementById('SGLCdlg-output').value = 'Unable to load game data (name) from Steam. This could be a server or API problem, or you entered an invalid appID. Please try again.\n\nIf you cannot resolve, please report the error. Thanks!';
				} else {
					document.getElementById('SGLCdlg-output').value = 'There was an error loading data from Steam. This could be a server or API problem. Please try again.\n\nIf you cannot resolve, please report the error. Thanks!';
				}
			}
		}
	}
}
