'use strict';

var DEBUG = false;
var SYNC_SERVER = "http://stagex.cvds.ro";
var USER = "postal2600"

var running = false;
var frequency = 10; //each n seconds we check a new item
var sessionID;
var currentItemURL;

function init()
{
	$.ajax({
		url: "https://steamcommunity.com/market",
		type: "GET",
		success: function(response){
			var sidRegExp = /g_sessionID = "(.*?)";/g;
			var match = sidRegExp.exec(response);

			if (match.length == 2)
			{
				sessionID = match[1];

                getSyncData(function(){
                    startProccessing();
                    updateBadge();
                });
			}
			else
			{
				//not logged in ?
                showNotification("Could not get sessionID. Not logged in ?");
			}
		}
	});
}

function getSyncData(callback)
{
    $.ajax({
        url: SYNC_SERVER + "/getData",
        dataType: "json",
        success: function(response){
            var data = JSON.parse(response.data);

            setStoreValue("watchedItems", data.watchedItems);
            setStoreValue("boughtItems", data.boughtItems);

            callback.call();
        },
        error: function(){
            showNotification("Error getting sync info. Continue with local info.");
            callback.call();
        }
    });
}

function setSyncData()
{
    $.ajax({
        url: SYNC_SERVER + "/setData",
        type: "POST",
        data:{
            data: JSON.stringify({watchedItems: getStoreValue("watchedItems", {keys: []}), boughtItems: getStoreValue("boughtItems", [])})
        },
        error: function(){
            showNotification("Error setting sync info.");
        }
    });
}

function processNextItem()
{
	var watchedItems = getStoreValue("watchedItems", {keys: []});

	// if no more items, just halt
	if (watchedItems.keys.length == 0)
	{
		running = false;
		return;
	}

	running = true;

	var nextItemKey;

	if (watchedItems.keys.length > 1)
	{
		// select the first item and put it back in the queue
        nextItemKey = watchedItems.keys.splice(0, 1)[0]; // pop(0)
        watchedItems.keys.push(nextItemKey);
		setStoreValue("watchedItems", watchedItems);
	}
	else
        nextItemKey = watchedItems.keys[0];

    var item = watchedItems[nextItemKey];

    $.ajax({
        url:item.url,
        success: $.proxy(processItemMarketPage, item),
        error: function(){
            console.error("Could not read item page for: %s", item.name);
            if (!DEBUG)
                setTimeout(processNextItem, frequency * 1000);
        }
    });

    currentItemURL = item.url;
    chrome.runtime.sendMessage({action: "startProccessingItem", itemURL: currentItemURL});
    var now = new Date();
    console.log("[%s:%s:%s] Processing: %s", String("0" + now.getHours()).slice(-2), String("0" + now.getMinutes()).slice(-2), String("0" + now.getSeconds()).slice(-2), item.name);
}

function processItemMarketPage(response)
{
	var item = this;
	var response = $(response);
	
    var pricePlusFee = NaN;
    var step = 0;
    var firstEntry, listingid;
    
    // skip until find an item with valid price
    // usually, skip the sold ones
    while (isNaN(pricePlusFee))
    {
        firstEntry = $(response.find("#searchResultsRows .market_listing_row")[step]);        
    
        // we reach the end of the list
        // or we got the 'There was an error getting listings for this item. Please try again later.' error.
        // TODO: change the page if end list ?
        if (!firstEntry.attr("id"))
        {
            console.error("Couldn't find valid entry.");

            if (!DEBUG)
                setTimeout(processNextItem, frequency * 1000);

            return;
        }

    	listingid = firstEntry.attr("id").split("_")[1];
    	pricePlusFee = parseFloat(firstEntry.find(".market_listing_price_with_fee").html().replace(/^[\s\n]+|[\s\n]+$/g, '').replace(",", "."));
        step ++;
    }

    if (step > 1)
        console.log("Skipped to entry %d", step);

	var priceMinusFee = parseFloat(firstEntry.find(".market_listing_price_without_fee").html().replace(/^[\s\n]+|[\s\n]+$/g, '').replace(",", "."));

	var gameFee = Math.floor(priceMinusFee * 0.1 * 100) || 1;
	var steamFee = Math.floor(priceMinusFee * 0.05 * 100) || 1;

    console.log("Price was: %f. Wanted: %f", pricePlusFee, item.price);

	if (pricePlusFee <= item.price)
		buy(item.url, listingid, priceMinusFee * 100, gameFee + steamFee, pricePlusFee * 100);
    else
        if (!DEBUG)
            setTimeout(processNextItem, frequency * 1000);

    chrome.runtime.sendMessage({action: "finishedProccessingItem", itemURL: item.url, nextIn: frequency});
}

// inject the buying script inside a normal market page to trick the origin and referer
function buy(itemURL, listingid, subtotal, fee, total)
{
	var extId = "lbdckfbenlbdafbhpdakppfokinpcoje";

	var code = "$.ajax({"+
			"url: 'https://steamcommunity.com/market/buylisting/"+listingid+"',"+
			"type: 'POST',"+
			"data:{"+
			"	sessionid: 	'"+ sessionID +"',"+
			"	currency: 	3,"+
			"	subtotal: 	"+ subtotal +","+
			"	fee: 		"+ fee +","+
			"	total: 		"+ total+
			"},"+
			"crossDomain: true,"+
			"xhrFields: { withCredentials: true },"+
			"success: function(){chrome.runtime.sendMessage({'action': 'itemBought', 'bought': '"+itemURL+"', 'price': "+total+"});window.close();},"+
            "error: function(req, response){chrome.runtime.sendMessage({'action': 'failToBuy', 'reason': req.responseText });window.close();}"+
		"});";

    if (DEBUG)
        // fake buy
        code = "chrome.runtime.sendMessage({'action': 'itemBought', 'bought': '"+itemURL+"', 'price': "+total+"});window.close();";

	chrome.tabs.create({
		url: itemURL,
		active: false
	}, function(tab){
		var injectDetails = {
			code: code,
			runAt: "document_end"
		};

		chrome.tabs.executeScript(tab.id, {"file": "/assets/js/jquery.js"}, function(){
			chrome.tabs.executeScript(tab.id, injectDetails);
		});
	})
}

function updateBadge(status)
{
	if (!status)
	{
		var boughtItemsCount = getStoreValue("boughtItems", []).length;

        if (boughtItemsCount)
        {
            chrome.browserAction.setBadgeText({text: ""+boughtItemsCount})
            chrome.browserAction.setBadgeBackgroundColor({color: "#587238"});
        }
        else
            chrome.browserAction.setBadgeText({text: ""});
	}
	else
	{
		chrome.browserAction.setBadgeText({text: status})
		chrome.browserAction.setBadgeBackgroundColor({color: "#FF0000"});
	}
}

function startProccessing()
{
	if (!running)
		processNextItem();
}

function addItem(item)
{
	var items = getStoreValue("watchedItems", {keys:[]});

    items[item.url] = item;
    items.keys.push(item.url);

	setStoreValue("watchedItems", items);
	startProccessing();
	updateBadge();
    setSyncData();
}

function removeItem(itemURL)
{
	var items = getStoreValue("watchedItems", {});

    if (items[itemURL])
    {
        delete items[itemURL];
        items.keys.splice(items.keys.indexOf(itemURL), 1);

        setStoreValue("watchedItems", items);
        updateBadge();
        setSyncData();
    }
}

function updateItem(newItem)
{
    var items = getStoreValue("watchedItems", false);

    if (!items || !items[newItem.url])
        return;

    $.extend(items[newItem.url], newItem);

    setStoreValue("watchedItems", items);
    setSyncData();
}

function addBoughtItem(itemURL, price)
{
    var items = getStoreValue("watchedItems", {});
    var boughtItems = getStoreValue("boughtItems", []);

    var item = items[itemURL];
    item.quantity --;

    if (item.quantity == 0)
        removeItem(itemURL);
    else
        updateItem(itemURL, item);

    item.acquisitionDate = new Date();
    item.price = price / 100;
    delete item.quantity;

    boughtItems.push(item);
    setStoreValue("boughtItems", boughtItems);

    if (item.quantity == 0)
    {
        removeItem(itemURL);
    }

    showNotification(item.name + ' for ' + item.price +"€", 'Item bought', item.picture);
    updateBadge();
    setSyncData();
    console.log("Bought!");
}

function showNotification(message, title, picture)
{
    if (!title)
        title = "Steamroller";

    if (!picture)
        picture = "assets/img/icon.png";

    webkitNotifications.createNotification(picture, title, message).show();
}

function handleMessages(request, sender, sendResponse)
{
	if (request.action == "addItem")
	{
		addItem(request.item);
		sendResponse();
	}else

	if (request.action == "removeItem")
	{
		removeItem(request.itemURL);
		sendResponse();
	}else

    if (request.action == "updateItem")
    {
        updateItem(request.newitem);
        sendResponse();
    }else

	if (request.action == "getWatchedItems")
	{
		sendResponse({items: getStoreValue("watchedItems", {keys:[]})});
	}else

    if (request.action == "getBoughtItems")
    {
        sendResponse({items: getStoreValue("boughtItems", [])});
    }else

    if (request.action == "itemBought")
	{
        addBoughtItem(request.bought, request.price);

        if (!DEBUG)
            setTimeout(processNextItem, frequency * 1000);

        sendResponse();
	}else

    if (request.action == "failToBuy")
    {
        var reason = JSON.parse(request.reason).message;
        console.error("Failed to buy: %s", reason);

        if (!DEBUG)
            setTimeout(processNextItem, frequency * 1000);

        sendResponse();
    }else


    if (request.action == "clearBought")
    {
        setStoreValue("boughtItems", []);
        updateBadge();
        setSyncData();
        sendResponse();
    }else

    if (request.action == "openURL")
    {
        chrome.tabs.create({
            url: request.url
        });

        sendResponse();
    }else

    if (request.action == "getCurrentItem")
    {
        sendResponse({itemURL: currentItemURL});
    }

}

chrome.runtime.onMessage.addListener(handleMessages);

init();
