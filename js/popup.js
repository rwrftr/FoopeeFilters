// grab the box and the label text
const box = document.getElementById('toggle');
const boxText = document.getElementById('boxLabel');

// output to console to make sure the elements are found
console.log('popup.js loaded');
console.log(box);
console.log(boxText);
console

// load stored state (default = true)
chrome.storage.local.get({ extensionEnabled: true }, ({ extensionEnabled }) => {
  box.checked = extensionEnabled;
  boxText.childNodes[0].textContent = `Extension: ${box.checked ? "on" : "off"}`;
});

// add event listener to the box, executes function
box.addEventListener('change', function() {
  // update the text
  const enabled = box.checked;
  boxText.childNodes[0].textContent = `Extension: ${enabled ? "on" : "off"}`;
  
  // store the state and reload the current tab
  chrome.storage.local.set({ extensionEnabled: enabled }, () => {
    // get current tab
    chrome.tabs.query({ url: "http://www.foopee.com/punk/the-list/*" }, tabs => {
      if (tabs[0].id === undefined) {
        console.log("No matching Foopee list tabs found.");
        return;
      }
      tabs.forEach(tab => chrome.tabs.reload(tab.id));
    });
  });
  console.log(`Extension state changed: ${box.checked}`);
});
