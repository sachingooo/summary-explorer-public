/**
 * This file contains the JavaScript code for the index page of the website.
 * It includes functions for handling user interactions, updating the content, and managing the modal window.
 * The code also utilizes local storage to store and retrieve user preferences and review progress.
 */

let content = getCurrentTestContent();
let searchIndex = buildSearchIndex();
let completedQuestionData = [];

let reviewProgress = {};
let cachedReviewProgressString = localStorage.getItem(CURRENT_REVIEW_PROGRESS_CACHE_KEY);
if (cachedReviewProgressString) {
	reviewProgress = JSON.parse(cachedReviewProgressString);
}
const qidsReviewedInSession = new Set();
let numReviewsInSession = 0;
let navigationHistory = [];
const cachedNavigationHistoryString = localStorage.getItem(CURRENT_NAVIGATION_HISTORY_CACHE_KEY);
if (cachedNavigationHistoryString) {
	navigationHistory = JSON.parse(cachedNavigationHistoryString);
}
navigationHistory = navigationHistory || [];

let subjects = [... new Set(content.map((e) => e.subject))]
let currentSearch = "";
let currentEoQid = content[0]?.qid;
let sorted = false;
const cachedSortPref = !!localStorage.getItem(CURRENT_SORT_PREF_CACHE_KEY); //retrieve truthy or falsy value
sorted = cachedSortPref;

let virtualScroller = null;

let isLightMode = (localStorage.getItem(CURRENT_APPEARANCE_CACHE_KEY) || "light") == "light";
setTheme(isLightMode ? "light" : "dark");
let isFlagMode = false;
let isCompletedMode = false;
let showHidden = true;
let isSmoothScrolling = false;

window.addEventListener('keydown', function (e) {
	if (e.keyCode === 114 || (e.ctrlKey && e.key === "f")) {
		//Ctrl+F
		if (document.getElementById('search') !== document.activeElement) {
			e.preventDefault();
			document.getElementById('search').focus();
		} else {
			return true;
		}
	} else if (e.key === "ArrowDown") {
		if (isSmoothScrolling) {
			return;
		}
		e.preventDefault();
		scrollToNewEo(true);
	} else if (e.key === "ArrowUp") {
		if (isSmoothScrolling) {
			return;
		}
		e.preventDefault();
		scrollToNewEo(false);
		return;
	} else if (e.key === "Escape") {
		//escape key
		closeModal();
	} else if (e.key === "e") { //nice
		//e for exhibit

		//check that we're not in a text field
		if (document.activeElement.tagName.toLowerCase() == "input") {
			return;
		}

		const currentEo = content.filter((i) => i['qid'] == currentEoQid)[0];
		if (!currentEo) {
			return;
		}

		if (!currentEo['exhibits'].length) {
			//no exhibits --> close modal
			closeModal();
			return;
		}

		//check if modal is already open
		//if it's open and 
		const modal = document.getElementById("detailsModal");
		if (modal.style.display == "block") {
			if (currentEo['exhibits'].length > 1) {
				//if it's open and has multiple exhibits, open the next one
				const currentIndex = getModalCurrentIndex();
				if (currentIndex == -1) {
					//if the current exhibit isn't in the list, open the first one
					openModal(currentEo, 0);
					return;
				}

				const nextIndex = (currentIndex + 1) % currentEo['exhibits'].length;
				openModal(currentEo, nextIndex);
			}
		} else {
			//if it's closed, open the first exhibit
			if (currentEo['exhibits'].length) {
				openModal(currentEo, 0);
			}
		}
	} else if (e.key === "f") {
		//check that we're not in a text field
		if (document.activeElement.tagName.toLowerCase() == "input") {
			return;
		}

		//toggle the flag for the current question
		let qidIsFlagged = getFlaggedQids().includes(currentEoQid);
		if (qidIsFlagged) {
			unflagEo(currentEoQid);
		} else {
			flagEo(currentEoQid);
		}
	}
});

window.addEventListener('keyup', function (e) {
	if (e.key === 'ArrowDown') {
		if (isSmoothScrolling) {
			e.preventDefault();
			scrollToNewEo(true);
		}
	} else if (e.key === 'ArrowUp') {
		if (isSmoothScrolling) {
			e.preventDefault();
			scrollToNewEo(false);
		}
	}
});

function toggleTheme() {
	setTheme(isLightMode ? "dark" : "light");
}

function setTheme(theme) {
	isLightMode = theme == "light";
	localStorage.setItem(CURRENT_APPEARANCE_CACHE_KEY, isLightMode ? "light" : "dark");
	const themeIcon = document.getElementById("themeIcon");
	if (isLightMode) {
		document.body.classList.add("lightTheme");
		document.body.classList.remove("darkTheme");
		themeIcon.classList.add("bi-moon");
		themeIcon.classList.remove("bi-sun");
	} else {
		document.body.classList.add("darkTheme");
		document.body.classList.remove("lightTheme");
		themeIcon.classList.add("bi-sun");
		themeIcon.classList.remove("bi-moon");
	}
}

function toggleFlagged() {
	setFlagMode(!isFlagMode);
}

function setFlagMode(flagMode) {
	isFlagMode = flagMode;
	const flagIcon = document.getElementById("flagIcon");
	if (isFlagMode) {
		document.body.classList.add("flagMode");
		flagIcon.classList.add("bi-flag-fill");
		flagIcon.classList.remove("bi-flag");
	} else {
		document.body.classList.remove("flagMode");
		flagIcon.classList.remove("bi-flag-fill");
		flagIcon.classList.add("bi-flag");
	}
	updateContent();
}

function getFlaggedQids() {
	const flaggedQidsString = localStorage.getItem(CURRENT_FLAGGED_QIDS_CACHE_KEY);
	if (!flaggedQidsString) {
		return [];
	}
	return JSON.parse(flaggedQidsString);
}

function flagEo(qid) {
	const flaggedQids = getFlaggedQids();
	if (!flaggedQids.includes(qid)) {
		flaggedQids.push(qid);
		localStorage.setItem(CURRENT_FLAGGED_QIDS_CACHE_KEY, JSON.stringify(flaggedQids));
	}

	updateFlagIconForEo(qid, true);
}

function unflagEo(qid) {
	const flaggedQids = getFlaggedQids();
	const newFlaggedQids = flaggedQids.filter((f) => f !== qid);
	localStorage.setItem(CURRENT_FLAGGED_QIDS_CACHE_KEY, JSON.stringify(newFlaggedQids));

	updateFlagIconForEo(qid, false);
}

function updateFlagIconForEo(qid, isFlagged) {
	const eoContainer = document.getElementById(getIdForEo(qid));
	if (!eoContainer) {
		return;
	}
	const flagIcon = eoContainer.getElementsByClassName("flagIcon")[0];
	if (isFlagged) {
		flagIcon.classList.add("bi-flag-fill");
		flagIcon.classList.remove("bi-flag")
	} else {
		flagIcon.classList.remove("bi-flag-fill");
		flagIcon.classList.add("bi-flag");
	}
}

function toggleCompleted() {
	setCompletedMode(!isCompletedMode);
}

function setCompletedMode(completedMode) {
	isCompletedMode = completedMode;

	//if there's no remote storage, we can't use the completed mode
	if (!hasRemoteStorage()) {
		isCompletedMode = false;
	}

	const completedIcon = document.getElementById("completedIcon");
	if (isCompletedMode) {
		document.body.classList.add("completedMode");
		completedIcon.classList.add("bi-check-square-fill");
		completedIcon.classList.remove("bi-check-square");
	} else {
		document.body.classList.remove("completedMode");
		completedIcon.classList.remove("bi-check-square-fill");
		completedIcon.classList.add("bi-check-square");
	}
	updateContent();
}

function getCompletedQids() {
	if (!hasRemoteStorage() || !completedQuestionData?.length) {
		return new Set();
	}

	return completedQuestionData.map((c) => c.qid);
}

function toggleHiddenMode() {
	setShowHiddenMode(!showHidden);
}

function setShowHiddenMode(hiddenMode) {
	showHidden = hiddenMode;
	const hiddenIcon = document.getElementById("hiddenIcon");
	if (showHidden) {
		document.body.classList.add("showHidden");
		hiddenIcon.classList.add("bi-eye");
		hiddenIcon.classList.remove("bi-eye-slash");
	} else {
		document.body.classList.remove("showHidden");
		hiddenIcon.classList.remove("bi-eye");
		hiddenIcon.classList.add("bi-eye-slash");
	}
	updateContent();
}

/**
 * Builds a search index object based on the content
 * @returns {Object} - The search index object.
 */
function buildSearchIndex() {
	const searchIndex = {};
	const exEl = document.createElement("div");
	for (const eo of content) {
		const searchTerms = [eo['subject'], eo['secondarySubject'], eo['topicAttribute'], eo['topic'], eo['title'], eo['text']];
		for (const ex of eo['exhibits']) {
			if (ex.includes(".com")) {
				continue;
			}
			exEl.innerHTML = ex;
			const exText = exEl.textContent;
			searchTerms.push(exText);
		}
		const searchTermsJoined = searchTerms.map((s) => s ? s.toLowerCase() : "").join(" ");
		searchIndex[eo['qid']] = searchTermsJoined;
	}
	exEl.remove();

	return searchIndex;
}

/**
 * Dynamically retrieves the content for the current test type - first checks which test is active
 * @returns {Array} - The content for the current test type
 */
function getCurrentTestContent() {
	if (!Object.keys(cont).length) {
		//check if there's any content at all by checking if cont has any keys in it
		return [];
	}

	let currentTest = localStorage.getItem(CURRENT_TEST_TYPE_CACHE_KEY);

	const selectTestSpan = document.getElementById("selectTestSpan");
	const selectTest = document.getElementById("selectTest");
	const oneTest = document.getElementById("oneTest");

	if (getValidTestTypes().length === 1) {
		selectTestSpan.style.display = "none";
		oneTest.style.display = "";
		//set the value of currentTest to the only option
		currentTest = getValidTestTypes()[0];
	} else {
		selectTestSpan.style.display = "";
		oneTest.style.display = "none";
	}

	//verify that the test type is valid
	if (!getValidTestTypes().includes(currentTest)) {
		currentTest = getValidTestTypes[0];
	}

	switch (currentTest) {
		case TEST_TYPE.Step_1.key: {
			selectTest.value = TEST_TYPE.Step_1.key;
			oneTest.innerHTML = TEST_TYPE.Step_1.display;
			return getSpecificTestContent(TEST_TYPE.Step_1.key);
		}
		case TEST_TYPE.Step_2.key: {
			selectTest.value = TEST_TYPE.Step_2.key;
			oneTest.innerHTML = TEST_TYPE.Step_2.display;
			return getSpecificTestContent(TEST_TYPE.Step_2.key);
		}
		case TEST_TYPE.Bar.key: {
			selectTest.value = TEST_TYPE.Bar.key;
			oneTest.innerHTML = TEST_TYPE.Bar.display;
			return getSpecificTestContent(TEST_TYPE.Bar.key);
		}
		default: {
			return get_default_content();
		}
	}
}

function onTestSelectChanged(selectElement) {
	document.getElementById("displayContentContainer").style.visibility = "hidden";
	setLoadingMessage("Reloading test content...");
	setTimeout(() => {
		setCurrentTest(selectElement.value);
		setLoadingMessage("");
		document.getElementById("displayContentContainer").style.visibility = "visible";
	}, 50);
}

function setCurrentTest(testType) {
	//verify that the test type is valid
	const validTestTypes = getValidTestTypes();
	if (!validTestTypes.includes(testType)) {
		testType = validTestTypes[0];
	}

	localStorage.setItem(CURRENT_TEST_TYPE_CACHE_KEY, testType);
	reinitialize();
}

/**
 * Checks if a DOM element is a descendant of another DOM element.
 * @param {Node} parent - The parent DOM element.
 * @param {Node} child - The child DOM element.
 * @returns {boolean} - True if the child is a descendant of the parent, false otherwise.
 */
function isDescendant(parent, child) {
	let node = child.parentNode;

	while (node != null) {
		if (node === parent) {
			return true;
		}
		node = node.parentNode;
	}

	return false;
}

/**
 * Reinitializes the content and display of the website.
 * @returns {void}
 */
function reinitialize() {
	content = getCurrentTestContent();
	subjects = [... new Set(content.map((e) => e.subject))];
	searchIndex = buildSearchIndex();

	if (sorted) {
		content.sort((a, b) => {
			const aSubj = a['subject'] + (a['secondarySubject'] ? "-" + a['secondarySubject'] : "");
			const bSubj = b['subject'] + (b['secondarySubject'] ? "-" + b['secondarySubject'] : "");
			if (aSubj.localeCompare(bSubj)) {
				return aSubj.localeCompare(bSubj);
			}
			if (a['topicAttribute'].localeCompare(b['topicAttribute'])) {
				return a['topicAttribute'].localeCompare(b['topicAttribute']);
			}
			if (a['topic'].localeCompare(b['topic'])) {
				return a['topic'].localeCompare(b['topic']);
			}
			if (a['title'].localeCompare(b['title'])) {
				return a['title'].localeCompare(b['title']);
			}
			return 0;
		});
	}

	//DYNAMIC SCROLL - YAY
	const displayContent = document.getElementById("displayContent");
	if (virtualScroller) {
		virtualScroller.setItems(content);
	} else {
		virtualScroller = new VirtualScroller(displayContent, content, createEo);
	}

	currentSearch = "";
	const cachedCurrentEoQid = localStorage.getItem(CURRENT_QID_CACHE_KEY);
	const cachedSearch = localStorage.getItem(CURRENT_SEARCH_CACHE_KEY);
	setCurrentEo(cachedCurrentEoQid || content[0].qid);
	setCurrentSearch(cachedSearch || "");
	updateNavigationHistory(cachedSearch || "");
}

const subjectColors = [
	"rgb(230, 250, 250)",
	"rgb(250, 230, 250)",
	"rgb(250, 250, 230)",
	"rgb(230, 230, 250)",
	"rgb(250, 230, 230)",
	"rgb(230, 250, 230)",
];
const subjectColorsDarker = [
	"rgb(175, 250, 250)",
	"rgb(250, 175, 250)",
	"rgb(250, 250, 175)",
	"rgb(175, 175, 250)",
	"rgb(250, 175, 175)",
	"rgb(175, 250, 175)",
]

/**
 * Returns the ID for the element containing the question with the given ID.
 * @param {string} qid - The ID of the question.
 * @returns {string} - The ID of the container element.
 */
function getIdForEo(qid) {
	return qid + "-container";
}

let debounceTimer;
function debounce(func, delay) {
	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(func, delay);
}

/**
 * Sets the current search value and updates the content and navigation history.
 * @param {string} search - The search value to set.
 */
function setCurrentSearch(search) {
	currentSearch = search.toLowerCase().trim();
	document.getElementById("search").value = search;
	updateContent();
	updateNavigationHistory(search);
}

function getFilteredContent() {
	let filteredMatching = !!currentSearch ? content.filter((eo) => searchIndex[eo['qid']].includes(currentSearch)) : content;
	if (isFlagMode) {
		const flaggedQids = getFlaggedQids();
		filteredMatching = filteredMatching.filter((eo) => flaggedQids.includes(eo['qid']));
	}

	if (isCompletedMode) {
		const completedQids = getCompletedQids();
		filteredMatching = filteredMatching.filter((eo) => completedQids.includes(eo['qid']));
	}

	return filteredMatching;
}

/**
 * Creates an element for an "eo" (educational objective) based on the provided data.
 * @param {Object} eo - The data object representing the "eo".
 * @returns {HTMLElement} - The created container element for the "eo".
 */
function createEo(eo) {
	const containerDiv = document.createElement("div");
	containerDiv.id = getIdForEo(eo['qid'])
	containerDiv.classList = ["eoContainer"];
	containerDiv.onclick = () => {
		setCurrentEo(eo['qid'])
	}
	const colIndex = subjects.indexOf(eo['subject']) % subjectColors.length;
	const col = subjectColors[colIndex];
	const colDark = subjectColorsDarker[colIndex];
	containerDiv.style = "--col: " + col + "; --colDark: " + colDark;
	containerDiv.classList.add("subjectColor" + (colIndex + 1));

	const p = document.createElement("p");
	p.innerHTML = eo['text'];
	p.className = "eo";

	const bottomContent = document.createElement("div");

	const tagSpan = document.createElement("span");
	tagSpan.className = "tags";

	let tags = [eo['subject'], eo['secondarySubject'], eo['topicAttribute'], eo['topic'], eo['title']];
	//remove duplicates and empty from tags
	tags = [... new Set(tags.filter((t) => !!t))];
	for (const t of tags) {
		const tag = document.createElement("a");
		tag.className = "tag";
		tag.text = t;
		tagSpan.appendChild(tag);
		tag.onclick = () => {
			setCurrentSearch(t);
			setCurrentEo(eo['qid']);
			updateNavigationHistory(t);
		}
	}

	const bottomIcons = document.createElement("span");
	bottomIcons.className = "bottomIcons";
	const viewIcon = document.createElement("i");
	viewIcon.className = "bi bi-eye";
	viewIcon.style.marginRight = "5px";
	const count = document.createElement("span");
	const currentReviewCount = reviewProgress[eo['qid']] || 0;
	count.textContent = currentReviewCount;
	count.className = "countNumber";
	bottomIcons.appendChild(viewIcon);
	bottomIcons.appendChild(count);

	if (eo['exhibits'].length) {
		const exhibitIcon = document.createElement("i");
		exhibitIcon.className = "bi bi-image icon";
		exhibitIcon.style.marginLeft = "15px";
		exhibitIcon.onclick = () => {
			openModal(eo, 0);
		};
		bottomIcons.appendChild(exhibitIcon);
	}

	const flagThisQidButton = document.createElement("i");
	const qidIsFlagged = getFlaggedQids().includes(eo['qid']);
	flagThisQidButton.className = qidIsFlagged ? "bi bi-flag-fill button flagIcon" : "bi bi-flag button flagIcon";
	flagThisQidButton.style.marginLeft = "15px";
	flagThisQidButton.style.cursor = "pointer";
	flagThisQidButton.onclick = () => {
		let qidIsFlagged = getFlaggedQids().includes(eo['qid']);
		if (qidIsFlagged) {
			unflagEo(eo['qid']);
		} else {
			flagEo(eo['qid']);
		}
	};
	bottomIcons.appendChild(flagThisQidButton);
	bottomIcons.classList.add("bottomIcons");

	containerDiv.appendChild(p);
	bottomContent.appendChild(tagSpan);
	bottomContent.appendChild(bottomIcons);
	containerDiv.appendChild(bottomContent);

	return containerDiv;
}

/**
 * Sets the content of the modal with the provided HTML.
 * @param {string} modalHTML - The HTML content to be set in the modal.
 */
function setModalContent(modalHTML) {
	const detailsContainer = document.getElementById("modalDetailsContainer");
	detailsContainer.innerHTML = modalHTML;
}

/**
 * Retrieves the content of the modal details container.
 * @returns {string} The HTML content of the modal details container.
 */
function getModalContent() {
	const detailsContainer = document.getElementById("modalDetailsContainer");
	return detailsContainer.innerHTML || "";
}

/**
 * Sets the current index of the modal. Updates the modal index display (there are totalExhibits circles, the (currentIndex)th index of which is emphasized).
 * @param {number} currentIndex - The current index of the modal.
 * @param {number} totalExhibits - The total number of exhibits.
 */
function setModalCurrentIndex(currentIndex, totalExhibits) {
	const modalIndexDisplay = document.getElementById("modalIndexDisplay");
	modalIndexDisplay.innerHTML = "";
	if (totalExhibits <= 1) {
		return;
	}

	const circleIndicators = [];
	for (let i = 0; i < totalExhibits; i++) {
		if (i == currentIndex) {
			circleIndicators.push("⬤");
		} else {
			circleIndicators.push("〇");
		}
	}

	modalIndexDisplay.innerHTML = circleIndicators.join(" ");
}

/**
 * Retrieves the current index of the modal.
 * @returns {number} The current index of the modal.
 */
function getModalCurrentIndex() {
	const modalIndexDisplay = document.getElementById("modalIndexDisplay");
	const currentExhibitIndex = modalIndexDisplay.innerHTML.split(" ").indexOf("⬤");
	return currentExhibitIndex;
}

/**
 * Opens a modal and sets the HTML content
 * @param {Object} currentEo - The current educational objective object
 * @param {number} index - The index of the current exhibit to display in the modal
 */
function openModal(currentEo, index) {
	const modal = document.getElementById("detailsModal");
	if (!currentEo['exhibits'].length || index < 0 || index >= currentEo['exhibits'].length) {
		return;
	}
	const modalHTML = currentEo['exhibits'][index];
	setModalContent(modalHTML);
	setModalCurrentIndex(index, currentEo['exhibits'].length);
	modal.style.display = "block";
}

/**
 * Closes the modal by hiding it.
 */
function closeModal() {
	setModalContent("");
	const modal = document.getElementById("detailsModal");
	modal.style.display = "none";
}

function updateResultsCount(currentIndex, totalResults) {
	document.getElementById("resultCount").textContent = (currentIndex + 1) + " of " + totalResults;
}

/**
 * Updates the content based on the current search query.
 */
function updateContent() {
	const search = currentSearch.toLowerCase().trim();
	let newCurrentEoQid = currentEoQid;

	const contentToDisplay = getFilteredContent(search);
	virtualScroller.setItems(contentToDisplay);
	const currentIndex = contentToDisplay.map((e) => e.qid).indexOf(currentEoQid);
	updateResultsCount(currentIndex, contentToDisplay.length);
	if (currentIndex == -1 && contentToDisplay.length) {
		newCurrentEoQid = contentToDisplay[0].qid;
	}

	setCurrentEo(newCurrentEoQid);
}

/**
 * Retrieves the current index of the visible Eo question.
 * @returns {number} - The index of the current visible Eo question.
 */
function getCurrentEoVisibileIndex() {
	const visibleEoQids = Array.from(document.querySelectorAll('.eoContainer')).filter((e) => e.style.display != "none").map((e) => e.id.split("-")[0]);
	return visibleEoQids.indexOf(currentEoQid.toString());
}

/**
 * Scrolls to the next or previous element in the list of visible EoQids.
 * @param {boolean} scrollDown - Indicates whether to scroll down (true) or up (false).
 */
function scrollToNewEo(scrollDown) {
	const filteredContent = getFilteredContent(currentSearch);
	if (!filteredContent.length) {
		return;
	}
	const currentEoIndex = filteredContent.map((e) => e.qid).indexOf(currentEoQid);
	if (currentEoIndex == -1) {
		setCurrentEo(filteredContent[0].qid);
		return;
	}
	const dir = !!scrollDown ? 1 : -1;
	const nextEoIndex = (currentEoIndex + dir + filteredContent.length) % filteredContent.length;
	setCurrentEo(filteredContent[nextEoIndex].qid);
}

/**
 * Sets the current Eo (End of) question ID and updates the UI accordingly.
 * @param {string} qid - The ID of the Eo question to set as current.
 */
function setCurrentEo(qid) {
	currentEoQid = qid;
	for (const eo of Array.from(document.getElementsByClassName("currentEo"))) {
		eo.classList.remove("currentEo");
	}

	const filteredContent = getFilteredContent(currentSearch);
	let newEoIndex = filteredContent.map((e) => e.qid).indexOf(currentEoQid);
	if (newEoIndex == -1) {
		if (!filteredContent.length) {
			//no content to display
			return;
		}
		//the current eo is not in the filtered content
		//set the current eo to the first one in the filtered content
		newEoIndex = 0;
		currentEoQid = filteredContent[0].qid;
		window.scrollTo({ top: 0, behavior: "instant" });
		setCurrentEo(currentEoQid);
		return;
	}
	updateResultsCount(newEoIndex, filteredContent.length);

	let newEo = document.getElementById(getIdForEo(currentEoQid));
	if (!newEo) {
		//set the current eo to the currently visble one (the middle child of the displayContent div)
		const visibleEos = Array.from(document.getElementById("displayContent").children);
		const middleIndex = Math.floor(visibleEos.length / 2);
		newEo = visibleEos[middleIndex];
		currentEoQid = newEo.id.split("-")[0];
		setCurrentEo(currentEoQid);
		return;
	}
	newEo.classList.add("currentEo");
	if (isSmoothScrolling) {
		newEo.scrollIntoView({ behavior: "smooth", block: 'center' });
	} else {
		newEo.scrollIntoView({ behavior: "instant", block: 'center' });
	}

	//cache the current state to localStorage
	localStorage.setItem(CURRENT_QID_CACHE_KEY, currentEoQid || "");
	localStorage.setItem(CURRENT_SEARCH_CACHE_KEY, currentSearch || "");
	localStorage.setItem(CURRENT_SORT_PREF_CACHE_KEY, sorted ? "1" : ""); //truthy vs falsy
	saveReview(currentEoQid);

	//if the modal is currently open, update the modal with the new content
	const currentEo = content.filter((i) => i['qid'] == currentEoQid)[0];
	if (!currentEo) {
		return;
	}
	const modal = document.getElementById("detailsModal");
	if (modal.style.display == "block") {
		if (currentEo['exhibits'].length) {
			openModal(currentEo, 0);
		} else {
			closeModal();
		}
	}
}

/**
 * Saves the review progress for a specific question.
 * 
 * @param {string} qid - The ID of the question.
 * @returns {void}
 */
function saveReview(qid) {
	if (qidsReviewedInSession.has(qid)) {
		//already reviewed in this session - skip;
		return;
	}
	qidsReviewedInSession.add(qid);
	if (!reviewProgress[qid]) {
		reviewProgress[qid] = 0;
	}
	reviewProgress[qid] += 1;
	numReviewsInSession += 1;
	document.getElementById(getIdForEo(qid)).getElementsByClassName("countNumber")[0].textContent = reviewProgress[qid];

	//every so often, save progress
	if (numReviewsInSession % 3 == 0) {
		localStorage.setItem(CURRENT_REVIEW_PROGRESS_CACHE_KEY, JSON.stringify(reviewProgress));
	}
}

/**
 * Updates the navigation history with the provided search query.
 * @param {string} search - The search query to be added to the navigation history.
 */
function updateNavigationHistory(search) {
	const prevNavigationState = navigationHistory.length ? navigationHistory[navigationHistory.length - 1] : undefined;
	if (!prevNavigationState) {
		navigationHistory.push({ search: search, qid: currentEoQid });
		return;
	}
	if (prevNavigationState.search.toLocaleLowerCase() == search.toLocaleLowerCase()) {
		//no duplicate entries
		return;
	}
	if (prevNavigationState.search.toLocaleLowerCase().includes(search.toLocaleLowerCase())) {
		//user is backspacing
		return;
	}
	if (search.toLocaleLowerCase().includes(prevNavigationState.search.toLocaleLowerCase())) {
		//user is typing in the field - update the previous nav state with the longer search
		navigationHistory[navigationHistory.length - 1].search = search;
		return;
	}

	navigationHistory.push({ search: search, qid: currentEoQid }); //new search
}


/**
 * Toggles the sorted state and updates the UI accordingly.
 */
function toggleSorted() {
	sorted = !sorted;
	if (sorted) {
		document.getElementById("sortIcon").classList.remove("bi-shuffle");
		document.getElementById("sortIcon").classList.add("bi-sort-down");
		document.getElementById("sortButton").title = "Randomize";
	} else {
		document.getElementById("sortIcon").classList.add("bi-shuffle");
		document.getElementById("sortIcon").classList.remove("bi-sort-down");
		document.getElementById("sortButton").title = "Sort";
	}

	const cachedSearch = currentSearch;
	const cachedCurrentEoQid = currentEoQid;
	reinitialize();
	setCurrentSearch(cachedSearch);
	setCurrentEo(cachedCurrentEoQid);
}

/**
 * Navigates back in the navigation history.
 * If the navigation history is empty, it sets the current search to an empty string.
 * @returns {void}
 */
function navigateBack() {
	if (!navigationHistory.length) {
		setCurrentSearch("");
		navigationHistory = [];
		return;
	}
	const lastNavState = navigationHistory.pop();
	setCurrentSearch(lastNavState.search);
	setCurrentEo(lastNavState.qid);
	navigationHistory.pop(); //we added it back with the previous call to setCurrentSearch - make sure it gets removed again
}

/**
 * Toggles the display of the help modal.
 */
function showHelp() {
	const helpShortcuts = [
		["Ctrl + F", "Search for keywords"],
		["⇑", "Previous objective"],
		["⇓", "Next objective"],
		["Esc", "Close details modal"],
		["e", "Open and toggle through exhibits"],
		["f", "Flag/unflag the current objective"],
	]

	const table = document.createElement("table");
	table.classList.add("help-table");
	for (const pair of helpShortcuts) {
		const row = document.createElement("tr");
		row.classList.add("help-table-row");
		const shortcutCell = document.createElement("td");
		shortcutCell.innerHTML = "<code class='help-shortcut'><b>" + pair[0] + "</b></code>";
		shortcutCell.classList.add("help-table-cell");
		const functionalityCell = document.createElement("td");
		functionalityCell.textContent = pair[1];
		functionalityCell.classList.add("help-table-cell");
		row.appendChild(shortcutCell);
		row.appendChild(functionalityCell);
		table.appendChild(row);
	}

	table.classList.add("helpContent");

	openModal({ exhibits: [table.outerHTML] }, 0);
}

/**
 * Sets the current test type and updates the content based on any URL parameters
 * Called after the page has loaded
 */
function setInitialParams() {
	const urlParams = new URLSearchParams(window.location.search);
	const search = urlParams.get('search');
	const test = urlParams.get('test');
	if (test) {
		setCurrentTest(test);
	}
	if (search) {
		setCurrentSearch(search);
	}
}

reinitialize();