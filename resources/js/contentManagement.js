const cont = {};
const decrypted = {};
let sessionPass = "";
//check if sessionPass was passed in via URL
const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());
if (params['sessionPass']) {
	sessionPass = params['sessionPass'];
}

const CURRENT_QID_CACHE_KEY = "currentEducationalObjectiveQuestionId";
const CURRENT_SEARCH_CACHE_KEY = "currentEducationalObjectiveSearch";
const CURRENT_SORT_PREF_CACHE_KEY = "currentEducationalObjectiveIsSorted";
const CURRENT_REVIEW_PROGRESS_CACHE_KEY = "currentEducationalObjectiveReviewProgress";
const CURRENT_NAVIGATION_HISTORY_CACHE_KEY = "currentEducationalObjectiveNavigationHistory";
const CURRENT_TEST_TYPE_CACHE_KEY = "currentEducationalObjectiveTest";
const CURRENT_APPEARANCE_CACHE_KEY = "currentEducationalObjectiveAppearance";
const CURRENT_FLAGGED_QIDS_CACHE_KEY = "currentEducationalObjectiveFlaggedQids";
const CURRENT_HIDDEN_QIDS_CACHE_KEY = "currentEducationalObjectiveHiddenQids";
const CURRENT_PERMITTED_TEST_TYPES_CACHE_KEY = "currentEducationalObjectivePermittedTestTypes";
const CURRENT_REMOTE_API_KEY_CACHE_KEY = "currentEducationalObjectiveRemoteApiKey";
const CURRENT_REMOTE_API_URL_CACHE_KEY = "currentEducationalObjectiveRemoteApiUrl";
const CURRENT_REMOTE_API_VERSION_CACHE_KEY = "currentEducationalObjectiveRemoteApiVersion";

//Test types.
const TEST_TYPE = {
	"Step_1": { key: "s1", display: "Step 1" },
	"Step_2": { key: "s2", display: "Step 2" },
	"Bar": { key: "bar", display: "Bar" },
}

function hasRemoteStorage() {
	return localStorage.getItem(CURRENT_REMOTE_API_KEY_CACHE_KEY) && localStorage.getItem(CURRENT_REMOTE_API_URL_CACHE_KEY);
}

async function sendApiGetReq(action, body, retry = true) {
	const remoteApiKey = localStorage.getItem(CURRENT_REMOTE_API_KEY_CACHE_KEY);
	const remoteApiUrl = localStorage.getItem(CURRENT_REMOTE_API_URL_CACHE_KEY);
	const version = localStorage.getItem(CURRENT_REMOTE_API_VERSION_CACHE_KEY);
	if (!remoteApiKey || !remoteApiUrl) {
		return;
	}

	// Send the request, then check if the response has the needsUpdate flag set to true
	// If it does, update the GAS URL and retry the request
	const updateReq = await fetch(`${remoteApiUrl}?api_key=${remoteApiKey}&action=${action}&version=${version}`, {
		method: "GET",
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept': '*/*'
		},
		body: JSON.stringify(body),
	});
	const updateResp = await updateReq.json();
	if (updateResp.needsUpdate && retry) {
		// Update the GAS URL if a new version is found
		localStorage.setItem(CURRENT_REMOTE_API_URL_CACHE_KEY, updateResp.latestVersionUrl);
		localStorage.setItem(CURRENT_REMOTE_API_VERSION_CACHE_KEY, updateResp.latestVersion);
		//retry the request with the new URL
		return sendApiGetReq(action, body, false); // Retry only once
	}

	//check the error flag
	if (updateResp.error) {
		console.error(updateResp.error);
	}

	return updateResp;
}

/**
 * Gets the registry keys from the URL or local storage.
 * First, it checks the URL for the keys. If the keys are not found in the URL, it checks the local storage.
 * If the keys are not found in the URL or local storage, empty strings are returned.
 * @returns {object} The registry keys, with explorer-key-1 and explorer-key-2 as keys.
 */
function getRegistryKeys() {
	const urlSearchParams = new URLSearchParams(window.location.search);
	const params = Object.fromEntries(urlSearchParams.entries());
	if (params['explorer-key-1'] && params['explorer-key-2']) {
		localStorage.setItem('explorer-key-1', params['explorer-key-1']);
		localStorage.setItem('explorer-key-2', params['explorer-key-2']);
	}

	if (localStorage.getItem('explorer-key-1') && localStorage.getItem('explorer-key-2')) {
		return {
			"explorer-key-1": localStorage.getItem('explorer-key-1'),
			"explorer-key-2": localStorage.getItem('explorer-key-2'),
		}
	}

	return {
		"explorer-key-1": "",
		"explorer-key-2": "",
	}
}

/**
 * Determines if the user has access to the content.
 * @returns {boolean} True if the user has access to the content, false otherwise.
 */
function userHasRegistryKeys() {
	const registryKeys = getRegistryKeys();
	return registryKeys['explorer-key-1'] && registryKeys['explorer-key-2'];
}

/**
 * Shows the loader element.
 */
function showLoader() {
	document.getElementById('loaderWrapper').style.display = '';
	if (document.getElementById('displayContent').classList.contains('fadeIn')) {
		document.getElementById('displayContent').classList.remove('fadeIn');
	}
}

function setLoadingMessage(message) {
	document.getElementById('loaderMessage').innerText = message;
	if (message) {
		showLoader();
	} else {
		hideLoader();
	}
}

/**
 * Hides the loader element.
 */
function hideLoader() {
	document.getElementById('loaderWrapper').style.display = 'none';
	if (!document.getElementById('displayContent').classList.contains('fadeIn')) {
		document.getElementById('displayContent').classList.add('fadeIn');
	}
}

/**
 * Decrypts the content using the provided key.
 * @param {string} content - The content to decrypt.
 * @param {string} key - The decryption key.
 * @returns {object} The decrypted content.
 */
function decryptContent(content, key) {
	if (decrypted && decrypted[key]) {
		// already decrypted
		return decrypted[key];
	}
	const registryKeys = getRegistryKeys();
	const firstKey = registryKeys['explorer-key-1'];
	const secondKey = registryKeys['explorer-key-2'];

	if (!sessionPass) {
		sessionPass = prompt('Enter password: ');
	}

	let decryptedSrc = CryptoJS.AES.decrypt(content, sessionPass).toString(CryptoJS.enc.Utf8);
	decryptedSrc = CryptoJS.AES.decrypt(decryptedSrc, secondKey).toString(CryptoJS.enc.Utf8);
	decryptedSrc = CryptoJS.AES.decrypt(decryptedSrc, firstKey).toString(CryptoJS.enc.Utf8);

	decryptedSrc = String.raw`${decryptedSrc}`;
	const decryptedObj = JSON.parse(decryptedSrc);
	decrypted[key] = decryptedObj;
	return decryptedObj;
}

/**
 * Dynamically loads content from the provided URL.
 * @param {string} url - The URL of the content to load.
 * @param {function} beforeCallback - The callback function to execute before loading the content.
 * @param {function} afterCallback - The callback function to execute after loading the content.
 */
function dynamicallyLoadContent(url, beforeCallback, afterCallback) {
	beforeCallback();
	var script = document.createElement("script"); // Make a script DOM node
	script.src = url; // Set its src to the provided URL
	script.onload = function () {
		afterCallback();
	};
	document.head.appendChild(script); // Add it to the end of the head section of the page
}

/**
 * Gets the specific test content for the given test key.
 * @param {string} testKey - The test key.
 * @returns {array} The decrypted content for the test key.
 */
function getSpecificTestContent(testKey) {
	if (!cont[testKey]) {
		return [];
	}
	return decryptContent(cont[testKey], testKey);
}

/**
 * Gets the valid test types based on the cached permitted test types, or from the url.
 * @returns {array} The valid test types.
 */
function getValidTestTypes() {
	//check the url params
	const urlSearchParams = new URLSearchParams(window.location.search);
	const params = Object.fromEntries(urlSearchParams.entries());
	if (params['explorer-allowed-test-types']) {
		const permittedTestTypes = params['explorer-allowed-test-types'];
		localStorage.setItem(CURRENT_PERMITTED_TEST_TYPES_CACHE_KEY, permittedTestTypes.join(','));
	}

	const cachedPermittedTestTypes = localStorage.getItem(CURRENT_PERMITTED_TEST_TYPES_CACHE_KEY);
	if (!cachedPermittedTestTypes?.length) {
		return [];
	}

	let validTestTypes = Object.keys(TEST_TYPE).map((k) => TEST_TYPE[k].key);

	// intersection 
	if (cachedPermittedTestTypes?.length) {
		const permittedTestTypes = cachedPermittedTestTypes.split(',');
		validTestTypes = validTestTypes.filter((testType) => permittedTestTypes.includes(testType));
	}

	return validTestTypes;
}

/**
 * Sets the valid test types and updates the select options.
 */
function setValidTestTypes() {
	const validTestTypes = getValidTestTypes();

	// we can dynamically update the select options based on the validTestTypes
	const selectTest = document.getElementById('selectTest');
	selectTest.innerHTML = '';
	validTestTypes.forEach((testType) => {
		const option = document.createElement('option');
		option.value = testType;
		// find the display name from TEST_TYPE object
		option.text = TEST_TYPE[Object.keys(TEST_TYPE).find((k) => TEST_TYPE[k].key === testType)].display;
		selectTest.appendChild(option);
	});

	for (const key in cont) {
		if (!validTestTypes.includes(key)) {
			delete cont[key];
			if (decrypted[key]) {
				delete decrypted[key];
			}
		}
	}

	if (!localStorage.getItem(CURRENT_TEST_TYPE_CACHE_KEY)) {
		localStorage.setItem(CURRENT_TEST_TYPE_CACHE_KEY, validTestTypes[0]);
	}
}

async function initializeAppMetadata() {
	if (!hasRemoteStorage()) {
		return;
	}

	const usernameData = await sendApiGetReq('get_app_metadata');
	if (!usernameData) {
		return;
	}

	document.getElementById('nameSpan').innerText = usernameData.name;
	document.getElementById('versionSpan').innerText = usernameData.latestVersion;
}

async function loadUserData() {
	if (!hasRemoteStorage()) {
		return;
	}

	const reviewProgressData = await sendApiGetReq('get_completed_questions');
	if (!reviewProgressData) {
		return;
	}

	if (!reviewProgressData.questionData?.length) {
		return;
	}

	// update the completedQuestionData
	completedQuestionData = reviewProgressData.questionData;
}

async function asyncLoadingSequence() {
	if (hasRemoteStorage()) {
		setLoadingMessage("Loading app metadata...");
		await initializeAppMetadata();
		setLoadingMessage("Loading user data...");
		await loadUserData();
		document.getElementById('nameVersionSpan').style.visibility = 'visible';
	}
	setLoadingMessage("");
	if (userHasRegistryKeys()) {
		setInitialParams();
		reinitialize();
		document.getElementById("headerContent").style.visibility = "visible";

		document.getElementById("displayContentContainer").style.visibility = "visible";
	}
}