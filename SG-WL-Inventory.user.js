// ==UserScript==
// @name         Whitelist Game Ownership Checker
// namespace     
// @version      0.01
// @description  Scans your whitelist for a particular game to see how many on your list own it. Many props ti Sighery for helping me with the API business and for creating the code I butchered to make this.
// @author       Gaffi
// icon          
// supportURL    
// @match        https://www.steamgifts.com/account/manage/whitelist*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_log
// @connect      api.steampowered.com
// @connect      store.steampowered.com
// ==/UserScript==

injectInterface();

function injectInterface() {
	var bFound = 0;
    var i=0;
    var refTarget;
    while(bFound==0) {
        refTarget = document.getElementsByClassName('page__heading__breadcrumbs')[i];
        if (refTarget.innerHTML.indexOf('<a href="/account">Account</a><i class="fa fa-angle-right"></i><a href="/account/manage/whitelist">Whitelist</a>')==0) {
            bFound = 1;
        } else i++;
    };

	 var scriptDiv = document.createElement("DIV");
    scriptDiv.id = "whitelist_ownership_checker";
    scriptDiv.className = 'form__submit-button';
    scriptDiv.innerHTML = "<i class='fa fa-arrow-circle-right'></i> Check game onwership";
    refTarget.parentNode.appendChild(scriptDiv);
    document.getElementById('whitelist_ownership_checker').addEventListener('click', checkWL, false);
}

function checkWL() {
	var apiKey = localStorage.getItem('APIKey');
	var steamID64;
	var rows = getRows();
	var appInput = prompt("Please enter the Steam app ID", "271590");
	if (appInput != null) {
	var appID = appInput.split(',');
		for (var i = 0; i < rows.length; i++) {
			checkHasGame(rows[i], appID, apiKey);
		}
	}
}

function importJSON(steamID, appids_filter, apiKey, row) {
    var int_appids_filter = turnToIntArray(appids_filter);
    var link = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=" + apiKey + '&input_json={"steamid":' + steamID + ',"appids_filter":' + JSON.stringify(int_appids_filter) + "}";
    var jsonFile;
    GM_xmlhttpRequest ({
        method: "GET",
        url: link,
        timeout: 5000,
        onload: function(response) {
            jsonFile = JSON.parse(response.responseText);
            if (jsonFile.response.game_count > 0) {
				injectMessage(row, true);
				//console.log('Has game');
            } else {
				injectMessage(row, false);
				//console.log('Does not have game');
			}
        },
    });
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


function checkHasGame(row, appID, apiKey) {
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
				importJSON(steamID, appID, apiKey, row);
            }
        }
    });
}

function injectMessage(elem, hasGame) {
    var message = document.createElement("div");
	if (hasGame) {
		message.style.color = "red";
		message.innerHTML = "Has game!";
	} else {
		message.style.color = "green";
		message.innerHTML = "Does not have game!";
	}
    elem.insertBefore(message, elem.children[2]);
}

function getRows() {
    return document.getElementsByClassName("table__row-inner-wrap");
}
