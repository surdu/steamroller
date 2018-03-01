$(document).ready(function(){
    chrome.runtime.onMessage.addListener(handleMessages);

    chrome.runtime.sendMessage({action: "getWatchedItems"}, function(response){
        if (response.items.keys.length)
        {
            var listEl = $("#watchedItems .itemsList");
            listEl.empty();

            for (var f=0; f<response.items.keys.length; f++)
            {
                var item = response.items[response.items.keys[f]];

                listEl.append(getItemDom(item, true));
            }
        }
    });

    chrome.runtime.sendMessage({action: "getBoughtItems"}, function(response){
        if (response.items.length)
        {
            var listEl = $("#boughtItems .itemsList");
            listEl.empty();

            for (var f=0; f<response.items.length; f++)
            {
                var item = response.items[f];

                listEl.append(getItemDom(item, true));
            }
        }
    });

    $("#clearBoughtBtn").click(function(){
        chrome.runtime.sendMessage({action: "clearBought"}, function(){
            location.reload();
        });
    })

    chrome.runtime.sendMessage({action: "getCurrentItem"}, function(response){
        setActive(response.itemURL);
    });

});

function showEditForm()
{
    var item = this;

    var editSection = $("#editSection");
    var sectionBody = editSection.find(".itemsList");

    sectionBody.empty();

    var editFormEl = $("<div id='editForm'></div>");

    var priceInputEl = $('<input type="number" id="price"/>');
    priceInputEl.val(item.price);
    editFormEl.append(priceInputEl);

    var quantityInputEl = $('<input type="number" id="quantity"/>');
    quantityInputEl.val(item.quantity);
    editFormEl.append(quantityInputEl);

    var updateBtnEl = $('<input type="button" value="Update"/>');
    updateBtnEl.click(function(){
        item.price = priceInputEl.val();
        item.quantity = quantityInputEl.val();

        chrome.runtime.sendMessage({action: "updateItem", newitem: item}, function(){
            location.reload();
        });
    });
    editFormEl.append(updateBtnEl);

    var reallyRemoveBtnEl = $('<input type="button" value="Sure!" id="confirmBtn"/>');
    reallyRemoveBtnEl.click(function(){

        chrome.runtime.sendMessage({action: "removeItem", itemURL: item.url}, function(){
            location.reload();
        });
    });
    editFormEl.append(reallyRemoveBtnEl);

    var removeBtnEl = $('<input type="button" value="Remove"/>');
    removeBtnEl .click(function(){
        $(this).css("display", "none");
        reallyRemoveBtnEl.css("display", "inline");
    });
    editFormEl.append(removeBtnEl );



    sectionBody.append(getItemDom(item));
    sectionBody.append(editFormEl);

    editSection.find(".sectionTitle").html(item.name);

    editSection.css("display", "block");
}

function getItemDom(item, listItem)
{
    var itemEl = $('<div class="item"></div>');
    itemEl.attr("title", item.name);
    itemEl.data("item", item);

    var imageEl = $('<img />');
    imageEl.attr("src", item.picture);
    itemEl.append(imageEl);

    if (listItem)
    {
        if (item.quantity) // is item in the watched items section ?
        {
            itemEl.click($.proxy(showEditForm, item));

            itemEl.attr("data-itemurl", item.url);

            var quantityEl = $('<div class="quantity info"></div>');
            quantityEl.html(item.quantity);
            itemEl.append(quantityEl)
        }
        else
        {
            itemEl.click(function(){
                chrome.runtime.sendMessage({action: "openURL", url: item.url});
            });
        }

        var priceEl = $('<div class="price info"></div>');
        priceEl.html(item.price + "&euro;");
        itemEl.append(priceEl);
    }
    else
    {
        itemEl.click(function(){
            chrome.runtime.sendMessage({action: "openURL", url: item.url});
        });
    }

    return itemEl;
}

function setActive(itemURL)
{
    if (itemURL)
    {
        $(".item").removeClass("active");
        $(".item[data-itemurl='"+itemURL+"']").addClass("active");
    }
}

function handleMessages(request, sender, sendResponse)
{
    if (request.action == "startProccessingItem")
    {
        setActive(request.itemURL);
        sendResponse();
    }
}