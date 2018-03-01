function getStoreValue(key, defaultValue)
{
	var value = localStorage[key];

	if (value)
		return JSON.parse(value);

	return defaultValue;
}

function setStoreValue(key, value)
{
	localStorage[key] = JSON.stringify(value);
}