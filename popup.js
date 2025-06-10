// grab the box and the label text
const box = document.getElementById('toggle');
const boxText = document.getElementById('boxLabel');

// output to console to make sure the elements are found
console.log('popup.js loaded');
console.log(box);
console.log(boxText);

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
    chrome.tabs.query({ active:true, currentWindow:true }, tabs => {
      // reload current tab
      chrome.tabs.reload(tabs[0].id);
    });
  });
  console.log(`Extension state changed: ${box.checked}`);
});
