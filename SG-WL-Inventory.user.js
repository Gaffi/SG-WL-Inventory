// ==UserScript==
// @name         SteamGifts Whitelist Inventory
// @namespace    https://github.com/Gaffi/SG-WL-Inventory
// @version      0.02
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
var lastPageScanned = 0;
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
	totalScanned = 0;
	totalHave = 0;
	appInput = prompt("Please enter the Steam app ID", "271590");
	if (appInput) {
		readAllPages("https://www.steamgifts.com/account/manage/whitelist/search?page=", 1);
		/*do while (!lastPageScanned) {
			// Wait for all WL pages to be read/scanned.
		}*/
		// Section above freezes forever (or too long for me to wait). Below will just wait 1.25 seconds per WL page and hope for the best for now.
		setTimeout(function(){
			alert("Out of " + totalScanned + " whitelisted users, " + totalHave + " have the game already, or " + Number((100*totalHave/totalScanned).toFixed(2)) + "%");
		}, getLastPage(document) * 1250);
	}
}

function checkAPIKey() {
	apiKey = localStorage.getItem('APIKey');
    if(!apiKey) {
        apiKey = prompt("A Steam API Key is required to perform the lookup. Please enter your Steam API key:", "");
        if(apiKey) {
            localStorage.setItem('APIKey', apiKey);
        }
    }
}

function importJSON(steamID, appids_filter, row) {
    'use strict';
    if (apiKey) {
        var int_appids_filter = turnToIntArray(appids_filter);
        var link = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" + apiKey + '&input_json={"steamid":' + steamID + ',"appids_filter":' + JSON.stringify(int_appids_filter) + "}";
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
                            // Clear API values to prevent more calls to API. Some will still get through, so hold off on alerting user until after process done.
                            injectMessage(row, 2);
                            localStorage.removeItem('APIKey');
                            apiKey = null;
                        } else {
                            console.log(e.name + " -- " + e.message);
                        }
                    }
					if (jsonFile) {
						if (jsonFile.response.game_count > 0) {
							injectMessage(row, 1);
							//Has game
						} else {

							injectMessage(row, 0);
							//Does not have game
						}
					}
				}
            },
        });
    } else { injectMessage(row, 2);}
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
            if (steamID.length > 0) {
                importJSON(steamID, appID, row);
            }
        }
    });
}

function injectMessage(elem, hasGame) {
    var message = getStatusDiv(elem);
	totalScanned += 1;
	switch (hasGame) {
        case 0:
            message.style.color = "green";
            message.innerHTML = "Does not have game.";
            break;
        case 1:
            message.style.color = "grey";
            message.innerHTML = "Has game.";
			totalHave +=1;
            break;
        case 2:

            message.style.color = "red";
            message.innerHTML = "Bad API Key!";
            break;
	}
    elem.insertBefore(message, elem.children[2]);
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
	var checkURL = currentURL + newPage;
	GM_xmlhttpRequest({
		method: "GET",
		url: checkURL,
		onload: function(response) {
			if (response){
				var lastPage = getLastPage(document);
				var lastURL = currentURL + lastPage;
				console.log(currentPage + '/' + lastPage);
				if (lastPage >= currentPage) {
					checkAPIKey();
					if (apiKey) {
						var rows = getRows(response.responseText);
						var appID = appInput.split(','); // Right now, only works with single appID. Probably will stay this way.
						console.log("Current page:" + currentPage + " - " + rows.length + " users to check.");
						for (var i = 0; i < rows.length; i++) {
							checkHasGame(rows[i], appID);
						}
					}
					readAllPages(currentURL, newPage + 1);
				} else {
					lastPageScanned = 1;
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
