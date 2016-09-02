// ==UserScript==
// @name         SteamGifts Whitelist Inventory
// @namespace    https://github.com/Gaffi/SG-WL-Inventory
// @version      0.05
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
var urlSteamApp = 'store.steampowered.com/app/';
var useSteam = false;


window.onload = function() {
	if (window.location.href.indexOf(urlSteamApp)>0) {
		console.log('Injecting Steam Store');
		useSteam = true;
		injectInterfaceSteam();
	} else {
		console.log('Injecting SteamGifts');
		useSteam = false;
		injectInterfaceSG();
	}
};

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
	var curURL = window.location.href;
	appInput = curURL.slice(curURL.lastIndexOf('/',curURL.length-2)+1,curURL.lastIndexOf('/',curURL.length));
	getWLCounts(false);
	console.log('Whitelist inventory button loaded without errors.');
}

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

function checkWL() {
	gameTitle = null;
	totalScanned = 0;
	totalHave = 0;
	
	if (!appInput) {
		appInput = prompt("Please enter the Steam app ID:\n\n(This should be just the numeric value, not the name or Steam/store URL.)", "271590");
	}	
	
	console.log('Scanning ' + wlCount + ' total whitelisted users.');
	if (appInput) {
		readAllWLPages(urlWhitelist + "/search?page=", 1);
	}
}

function getWLCounts(OnWLPage) {
	var linkPosition = 0;
	var searchURL = 'href="/account/manage/whitelist/search?page=';
	if (OnWLPage) {
		linkPosition = document.body.innerHTML.lastIndexOf(searchURL) + searchURL.length;
		wlPages = document.body.innerHTML.slice(linkPosition, document.body.innerHTML.indexOf('"',linkPosition-1));
		
		wlCount = parseInt(document.getElementsByClassName('sidebar__navigation__item__count')[0].innerHTML);
	} else {
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
					console.log(tempElem.getElementsByClassName('sidebar__navigation__item__count')[0].innerHTML);
					wlCount = parseInt(tempElem.getElementsByClassName('sidebar__navigation__item__count')[0].innerHTML);
					
					linkPosition = tempElem.innerHTML.lastIndexOf(searchURL) + searchURL.length;
					wlPages = tempElem.innerHTML.slice(linkPosition, tempElem.innerHTML.indexOf('"',linkPosition-1));
				}
			}
		});
	}
}

function checkAPIKey() {
	apiKey = localStorage.getItem('APIKey');
    if(!apiKey) {
        apiKey = prompt("A Steam API Key is required to perform the lookup. Please enter your Steam API key:\n\n(You can get/generate your API key here: https://steamcommunity.com/dev/apikey)", "https://steamcommunity.com/dev/apikey");
        if(apiKey) {
            localStorage.setItem('APIKey', apiKey);
        }
    }
}

function importJSONSteamGameDetail(steamID, appID) {
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

function importJSONSteamUserDetail(steamID, appids_filter) {
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

function turnToIntArray(oldArray) {
    var newArray = [];
    for (var i = 0; i < oldArray.length; i++) {
        newArray.push(parseInt(oldArray[i]));
    }
    return newArray;
}

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
				importJSONSteamGameDetail(steamID, appID);
			}
            if (steamID.length > 0) {
                importJSONSteamUserDetail(steamID, appID);
            }
			if (useSteam) { 
				inventoryDiv.innerHTML = "<span>Checking inventories: " + (100*totalScanned/wlCount).toFixed(1) + "%</span>";
			} else {
				inventoryDiv.innerHTML = "<i class='fa fa-arrow-circle-right'></i> Checking inventories: " + (100*totalScanned/wlCount).toFixed(1) + '%';
			}
        }
    });
}

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
			//Bad API Key!
            break;
	}
	//console.log(totalScanned + " - " + wlCount);
	if (totalScanned == wlCount) {
		alert('Out of ' + totalScanned + ' whitelisted SteamGifts ' + (totalScanned == 1 ? 'user, ' : 'users, ') + totalHave + ' already ' + (totalHave == 1 ? 'has "' : 'have "') + gameTitle + '" (' + Number((100*totalHave/totalScanned).toFixed(2)) + '%).');
		if (useSteam) {
			inventoryDiv.innerHTML = "<span>Check SteamGifts game ownership</span>";
		} else { 
			inventoryDiv.innerHTML = "<i class='fa fa-arrow-circle-right'></i> Check game ownership";
		}
	}
	if (!apiKey) {
		prompt("There was a problem with the request. This is possibly due to a bad API key being provided, but it may also be something I did, instead.\n\nPlease check your API key and try again. If the problem continues, please report a bug (copy link below)!","https://github.com/Gaffi/SG-WL-Inventory/issues");
	}
}

function getWLRows(curHTML) {
	var tempElem = document.createElement("div");
	tempElem.style.display = "none";
	tempElem.innerHTML = curHTML;
    return tempElem.getElementsByClassName("table__row-inner-wrap");
}

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
					checkAPIKey();
					if (apiKey) {
						var rows = getWLRows(response.responseText);
						var appID = appInput.split(','); // Right now, only works with single appID. Probably will stay this way.
						for (var i = 0; i < rows.length; i++) {
							checkHasGame(rows[i], appID);
						}
					}
					readAllWLPages(currentURL, newPage + 1);
				}
			}
		}
	});
}
