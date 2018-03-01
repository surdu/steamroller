$(document).ready(function(){
	//delay the executio due to pesky ajax list loading
	setTimeout(addUI, 1000);

	// add our ui when we change page from the pagenum
	window.onhashchange = addUI;

});

function injectJS(code)
{
	var script = document.createElement("script");
	script.type = "text/javascript";
	script.text = code;
	document.body.appendChild(script);
}

function getBtn(text, color)
{
	return 	$("<a class='item_market_action_button item_market_action_button_"+ color +" "+ color +"'>"+
			"<span class='item_market_action_button_edge item_market_action_button_left'></span>"+
			"<span class='item_market_action_button_contents'>"+ text +"</span>"+
			"<span class='item_market_action_button_edge item_market_action_button_right'></span>"+
			"</a>");
}

function addUI()
{
	// get watched items as a assoc array and the proceed to create the UI
	chrome.runtime.sendMessage({action: "getWatchedItems"}, function(response) {
		var itemsDict = response.items;

		// add our UI to all list elements
		$("a.market_listing_row_link").each($.proxy(function(index, htmlEntry){
			var htmlEntry = $(htmlEntry);
			var item = itemsDict[htmlEntry.attr("href")];

			var quantifier = $("<div class='quantifier'></div>");

			var minPriceInput = $("<input type='text' placeholder='Min. price' class='minPrice' />");
			minPriceInput.click(function(){return false;});

			var quantityInput = $("<input type='text' placeholder='Qty.' class='quantity' />");
			quantityInput.click(function(){return false;});


			quantifier.append(minPriceInput);
			quantifier.append(quantityInput);

			var updateBtn = getBtn("U", "green");
			updateBtn.click(updateItem);

			var removeBtn = getBtn("X", "green");
			removeBtn.click(removeItem);

			quantifier.append(updateBtn);
			quantifier.append(removeBtn);

			var doneBtn = getBtn("Add", "blue");
			doneBtn.click(addItem);

			quantifier.append(doneBtn);

			if (item)
			{
				quantifier.addClass("active");
				minPriceInput.val(item.price);
				quantityInput.val(item.quantity);

				doneBtn.css("display", "none");

				updateBtn.css("display", "inline-block");
				removeBtn.css("display", "inline-block");
			}
			else
			{
				doneBtn.css("display", "inline-block");

				updateBtn.css("display", "none");
				removeBtn.css("display", "none");
			}


			quantifier.insertAfter( htmlEntry.find(".market_listing_right_cell") );
		}, this));
	});
}

function validItem(item)
{
	//TODO: validate if chosen price is lower than current price

	if (!item.price)
	{
		alert("Invalid price");
		return false;
	}else

	if (!item.quantity)
	{
		alert("Invalid quantity");
		return false;
	}
	return true;
}

// add the item to watched list
function addItem()
{
	var message = {action: "addItem"};
	var wrapper = $(this).parents(".quantifier");

	message.item = {};
	message.item.url = $(this).parents(".market_listing_row_link").attr("href");
	message.item.price = parseFloat(wrapper.find(".minPrice").val());
	message.item.picture = $(this).parents(".market_listing_row_link").find(".market_listing_item_img").attr("src");
	message.item.name = $(this).parents(".market_listing_row_link").find(".market_listing_item_name").html();
	message.item.quantity = parseInt(wrapper.find(".quantity").val());

	if (!validItem(message.item))
		return false;

	chrome.runtime.sendMessage(message, function(response) {
		wrapper.addClass("active");
		wrapper.find(".blue").css("display", "none");
		wrapper.find(".green").css("display", "inline-block");
	});
	return false;
}

function removeItem()
{
	if (confirm("Are you sure ?"))
	{
		var message = {action: "removeItem"};

		var wrapper = $(this).parents(".quantifier");

		message.itemURL = $(this).parents(".market_listing_row_link").attr("href");

		chrome.runtime.sendMessage(message, function(response) {
			wrapper.removeClass("active");
			wrapper.find("input").val("");
			wrapper.find(".blue").css("display", "inline-block");
			wrapper.find(".green").css("display", "none");
		});
	}
	return false;
}

function updateItem()
{
	var message = {action: "updateItem"};

	var wrapper = $(this).parents(".quantifier");

	message.newitem = {};
	message.newitem.url = $(this).parents(".market_listing_row_link").attr("href");
	message.newitem.price = parseFloat(wrapper.find(".minPrice").val());
	message.newitem.quantity = parseInt(wrapper.find(".quantity").val());

	if (!validItem(message.newitem))
		return false;

	chrome.runtime.sendMessage(message, function(response) {
        alert("Item updated!");
	});

	return false;
}
