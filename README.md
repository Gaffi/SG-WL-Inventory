# SteamGifts Whitelist Inventory
### Who has that game already?
---

I was looking to give away some games to my whitelist and, to make it as fruitful of a giveaway as I could, I wanted to see how many people already had the game. If everyone on my list had it, it wouldn't be worth giving. Likewise if only 10 out of 100 didn't, that's still not doing the greatest service to those on my list. There was no way I was going to manually look up every user to find out if the GA was going to be worth it.

I looked to see if there were any scripts out there to do this for me, but alas, there were none, so I set out to fix that. A few days into the process, someone else on the forums asked for the same thing. Well, that kicked me into higher gear to make something useful for anybody else who wanted this functionality, and at this point, I think it's ready to show. It may not be 100% yet, but good enough probably for most.

I've built in some basic functionality that will scan through your whitelist for an appID (only one game at a time, and no subs at this point), and report a count of how many in your whitelist have it, and what the ratio to your overall list size is. As of right now, it should work on any active page of your WL. I have also been using it with [m0l0's Whitelist Wishlist and Tools](https://www.steamgifts.com/discussion/TSa4B/) with no (obvious) conflicts, though your header may get a little crowded if you use both.

The script uses the Steam API key (you can get yours [here](https://steamcommunity.com/dev/apikey). The first time you use the script, if you're not already using [Sighery's RaChart™ Enhancer](https://www.steamgifts.com/discussion/riOvr/)), you'll be prompted for your API key. After that, assuming you entered a valid key, the rest should work without needing to re-enter it. If there are problems, the script may prompt you to enter the API key again. I'm still working on making this as seamless as possible, but if you do hit an error, you will likely get hit with a bunch of alert pop-ups. Sorry!

If you find any bug, problems, or miscellaneous weirdness, please report them on the [GitHub issue log](https://github.com/Gaffi/SG-WL-Inventory/issues).

Thanks!
