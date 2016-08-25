// ==UserScript==
// @name         SteamGifts Whitelist Inventory
// @namespace    https://github.com/Gaffi/SG-WL-Inventory
// @version      0.03
// @description  Scans your whitelist for a particular game to see how many on your list own it. Many props to Sighery for helping me with the API business and for creating the code I butchered to make this.
// @author       Gaffi
// icon          
// @downloadURL  https://github.com/Gaffi/SG-WL-Inventory/raw/master/SG-WL-Inventory.user.js
// @supportURL   https://github.com/Gaffi/SG-WL-Inventory/raw/master/SG-WL-Inventory.meta.js
// @supportURL   https://github.com/Gaffi/SG-WL-Inventory
// @match        https://www.steamgifts.com/account/manage/whitelist*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_log
// @connect      api.steampowered.com
// @connect      store.steampowered.com
// ==/UserScript==

var apiKey = null;
var appInput = null;
var totalScanned = 0;
var totalHave = 0;
var wlCount = 0;
var gameTitle = null;
injectInterface();

function injectInterface() {
	var bFound=0;
    var i=0;
    var refTarget;
    while(bFound===0) {
        refTarget = document.getElementsByClassName('page__heading__breadcrumbs')[i];
        if (refTarget.innerHTML.indexOf('<a href="/account">Account</a><i class="fa fa-angle-right"></i><a href="/account/manage/whitelist">Whitelist</a>')===0) {
            bFound = 1;
        } else i++;
    }

    var scriptDiv = document.createElement("DIV");
    scriptDiv.id = "whitelist_ownership_checker";
    scriptDiv.className = 'form__submit-button';
    scriptDiv.innerHTML = "<i class='fa fa-arrow-circle-right'></i> Check game ownership";
    refTarget.parentNode.appendChild(scriptDiv);
    document.getElementById('whitelist_ownership_checker').addEventListener('click', checkWL, false);
}

function checkWL() {
	gameTitle = null;
	totalScanned = 0;
	totalHave = 0;
	appInput = prompt("Please enter the Steam app ID:\n\n(This should be just the numeric value, not the name or Steam/store URL.)", "271590");
	wlCount = parseInt(document.getElementsByClassName('sidebar__navigation__item__count')[0].innerHTML);
	//console.log('Scanning ' + wlCount + ' total whitelisted users.');
	if (appInput) {
		readAllPages("https://www.steamgifts.com/account/manage/whitelist/search?page=", 1);
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



function importJSONGameDetail(steamID, appids_filter) {
    'use strict';
    if (apiKey) {
        var int_appids_filter = turnToIntArray(appids_filter);
        var link = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" + apiKey + '&input_json={"steamid":' + steamID + ',"appids_filter":' + JSON.stringify(int_appids_filter) + ',"include_appinfo":1}';
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
                        var badAPIMsg = "Unexpected token < in JSON";
						if (apiKey) {
							if (e.name == 'SyntaxError' && e.message.slice(0,badAPIMsg.length) == badAPIMsg) {
								// Clear API values to prevent more calls to API. Some will still get through, so hold off on alerting user until after process done.
								localStorage.removeItem('APIKey');
								apiKey = null;
							} else {
								console.log("Uncaught error: " + e.name + " -- " + e.message);
							}
						}
                    }
					if (jsonFile) {
						if (!gameTitle) {
							if (jsonFile.response.game_count > 0) {
								gameTitle = jsonFile.response.games[0].name;
							}
						}
					}
				}
            },
        });
    }
}

function importJSONUserDetail(steamID, appids_filter) {
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
        url: row.children[1].children[0].href,
        onload: function(response) {
            var tempElem = document.createElement("div");
            tempElem.style.display = "none";
            tempElem.innerHTML = response.responseText;
			var steamIDdivhtml = tempElem.getElementsByClassName("sidebar__shortcut-inner-wrap")[0].innerHTML;
			var searchString1 = 'href="http://steamcommunity.com/profiles/';
			var searchString2 = '" data-tooltip=';
            var steamID = steamIDdivhtml.slice(steamIDdivhtml.indexOf(searchString1)+searchString1.length,steamIDdivhtml.indexOf(searchString2));
			if (!gameTitle) {
				importJSONGameDetail(steamID, appID);
			}
            if (steamID.length > 0) {
                importJSONUserDetail(steamID, appID);
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
		alert('Out of ' + totalScanned + ' whitelisted users, ' + totalHave + ' already have "' + gameTitle + '" (' + Number((100*totalHave/totalScanned).toFixed(2)) + '%).');
	}
	if (!apiKey) {
		prompt("There was a problem with the request. This is possibly due to a bad API key being provided, but it may also be something I did, instead.\n\nPlease check your API key and try again. If the problem continues, please report a bug (copy link below)!","https://github.com/Gaffi/SG-WL-Inventory/issues");
	}
}

function getStatusDiv(elem) {
	var statusDiv = elem.getElementsByClassName('WL_Inv_Status');
	if (statusDiv.length > 0) {
		return statusDiv[0];
	} else {
		var message = document.createElement("div");
		message.className = 'WL_Inv_Status';
		return message;
	}
}

function getRows(curHTML) {
	var tempElem = document.createElement("div");
	tempElem.style.display = "none";
	tempElem.innerHTML = curHTML;
    return tempElem.getElementsByClassName("table__row-inner-wrap");
}

function readAllPages(currentURL, currentPage) {
	var newPage = parseInt(currentPage);
	var checkURL = currentURL + currentPage;
	GM_xmlhttpRequest({
		method: "GET",
		url: checkURL,
		onload: function(response) {
			if (response){
				var lastPage = getLastPage(document);
				var lastURL = currentURL + lastPage;
				//console.log(currentPage + '/' + lastPage);
				if (lastPage >= currentPage) {
					checkAPIKey();
					if (apiKey) {
						var rows = getRows(response.responseText);
						var appID = appInput.split(','); // Right now, only works with single appID. Probably will stay this way.
						//console.log("Current page:" + currentPage + " - " + rows.length + " users to check.");
						for (var i = 0; i < rows.length; i++) {
							checkHasGame(rows[i], appID);
						}
					}
					readAllPages(currentURL, newPage + 1);
				}
			}
		}
	});
}

function getLastPage(curDocument) {
	var searchURL = 'href="/account/manage/whitelist/search?page=';
	var fullPageHTML = curDocument.getElementsByTagName("BODY")[0].innerHTML;
	var linkPosition = fullPageHTML.lastIndexOf(searchURL) + searchURL.length;
	return fullPageHTML.slice(linkPosition, fullPageHTML.indexOf('"',linkPosition-1));
}
