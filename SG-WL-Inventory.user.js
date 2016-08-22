// ==UserScript==
// @name         SteamGifts Whitelist Inventory
// @namespace    https://github.com/Gaffi/SG-WL-Inventory
// @version      0.01
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
    checkAPIKey();
    if (apiKey) {
        var steamID64;
        var rows = getRows();
        var appInput = prompt("Please enter the Steam app ID", "271590");
        if (appInput) {
        var appID = appInput.split(','); // Right now, only works with single appID.
        for (var i = 0; i < rows.length; i++) {
                checkHasGame(rows[i], appID);
            }
		}
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
                }
                if (jsonFile) {
                    if (jsonFile.response.game_count > 0) {
                        injectMessage(row, 1);
                        //console.log('Has game');
                    } else {

                        injectMessage(row, 0);
                        //console.log('Does not have game');
                    }
                }
            },
        });
    } else { injectMessage(row, 2);}



}

// Maybe will need this, maybe not.
/*function getApps(subID) {
    var link = "https://store.steampowered.com/api/packagedetails/?packageids=" + subID;
    GM_xmlhttpRequest({
        method: "GET",
        url: link,
        timeout: 3000,
        onload: function(response) {
            var jsonFile = JSON.parse(response.responseText);
            var arrayApps = [];
            for (var j = 0; j < jsonFile[subID]['data']['apps'].length; j++) {
                arrayApps.push(jsonFile[subID]['data']['apps'][j]['id']);
            }
            var int_appids_filter = turnToIntArray(arrayApps);
            var checkGames = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" + apiKey + '&input_json={"steamid":' + steamID64 + ',"appids_filter":' + JSON.stringify(int_appids_filter) + "}";
            GM_xmlhttpRequest({
                method: "GET",
                url: checkGames,
                onload: function(response) {
                    var jsonFile = JSON.parse(response.responseText);
                    if (jsonFile['response']['game_count'] == arrayApps.length) {
						console.log('Has game');
                        //highlight("sub/" + subID);
                    }
                    else if (jsonFile['response']['game_count'] != 0) {
						console.log('Has game');
                        //highlightSub("sub/" + subID);
                    }
					else { console.log('does not have game');}
                }
            });
        }
    });
}*/
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
	switch (hasGame) {
        case 0:
            message.style.color = "green";
            message.innerHTML = "Does not have game.";
            break;
        case 1:
            message.style.color = "grey";
            message.innerHTML = "Has game.";
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

function getRows() {
    return document.getElementsByClassName("table__row-inner-wrap");
}
