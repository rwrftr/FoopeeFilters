/* TODO:
    - replace "maximum price" slider with a more user friendly deisgn
    - add toggle to remove 'sold out' listings
    - group recognized locations to their main location (need to add a toggle for this in popup.js/html)
    - favorite listings on a page, and save them to local storage, toggle only show favorite listings
    - add share listing button and share all favorites button
    - favorite venues (save to storage), toggle show only favorite venues
    - favorite artists (save to storage), toggle show only favorite artists
    - recognize listing symbols:
        *    recommendable shows			        a/a  all ages
        $    will probably sell out			        @    pit warning
        ^    under 21 must buy drink tickets		#    no ins/outs
    
    - add days of the week selector?
    - add on hover band/venue effect to show/highlight other listings by the same band/venue

*/


function getPrice(fullText){
    // example fullText:
    //  Outside Lands, Golden Gate Park, S.F.</a> a/a $209 ($539 3 day ga) 11am #
    //  O'Reilly's, S.F.</a> 21+ $10/$15 8pm
    //  Kilowatt, S.F.</a> 21+ $$10-$20 7pm/8pm

    // ideal output:
    // idk
    // $15

    var price = "free or unspecified";
    const pattern = /(\$\d+|\d+\s*-\s*\d+)/;
    const priceMatch = [...fullText.matchAll(pattern)];

    if (priceMatch.length > 0) {



        price = priceMatch[0];
    }

    return price;
}

chrome.storage.local.get("extensionEnabled", (data) => {
    if (data.extensionEnabled) {
        (function () {
            console.log("[EXT] Content script loaded.");

            // Find the main listings
            const allDaySections = document.querySelectorAll("ul > li > ul");
            if (!allDaySections.length) {
                console.warn("[EXT] No <ul><li><ul> listings found.");
                return;
            }

            // create listings array, then populate it with the listing text
            const listings = [];
            allDaySections.forEach(ul => {
                const innerListings = ul.querySelectorAll("li");
                innerListings.forEach(li => listings.push(li));
            });

            console.log(`[EXT] Found ${listings.length} total event listings.`);

            // make sets for each listing element
            const locations = new Set();
            const prices = new Set();
            const ageRanges = new Set();
            const listingData = [];

            // extract info from each listing
            listings.forEach((li, idx) => {
                const boldLinks = li.querySelectorAll("b > a");
                const fullText = li.textContent.toLowerCase();
                const venueText = boldLinks[0].textContent.trim();
                const knownLoc = ['s.f', 'berkeley', 'oakland', 'memlo park', 'napa'];

                // find location
                let location = '';
                let venue = '';
                
                if (boldLinks.length === 0) {
                    // if theres no bolded info, skip it
                    console.log(`[EXT] [${idx}] Skipped listing — no <b><a> venue element.`);
                    return;
                } else if (!venueText.includes(',')){
                    // if theres no comma, check the full listing for known locations
                    knownLoc.forEach(val => {
                        if(fullText.includes(val)){location = val}
                    })
                } else {
                    // split by comma and extract location
                    let parts = venueText.split(",");
                    location = parts.pop().trim().toLowerCase(); // last part = location
                    //venue = parts.join(",").trim().toLowerCase(); // everything before = venue

                    // check if location is misspelled and group them to the correct location 
                    //  these are just based on ones ive seen, so as I see more ill try to add them
                    switch(location){
                        case 'okland':
                            location = 'oakland'
                            break;
                        
                        case 'memlo park':
                            location = 'menlo park'
                            break;  
                        
                        case 'richmnd':
                            location = 'richmond'
                            break;
                        
                        case 'mounte rio':
                            location = 'monte rio'
                            break;
                    }

                    // check if location is in a known location 
                    //  (for example, if the location is 'berkeley waterfront'
                    //  we want to just call it berkeley)
                    knownLoc.forEach(val => {
                        if(location.includes(val)){location = val}
                    })

                } 
                
                // find age
                let age = (() => {
                    if (fullText.includes('21+')) { return '21+'; }
                    else { return 'under 21'; }
                })();

                // mark sold out
                let soldOut = false;
                if (fullText.includes('sold out') || fullText.includes('soldout')) {
                    soldOut = true;
                    li.style.textDecoration = "line-through"; // visually mark as sold out
                }

                // Try to match prices like "$15", "$25/$30", "$10.50", etc.
                const priceMatch = fullText.match(/\$\d+(?:\.\d{2})?(?:\/\$\d+(?:\.\d{2})?)?/);
                const price = priceMatch ? priceMatch[0] : "free or unspecified";

                locations.add(location);
                prices.add(price);
                ageRanges.add(age);

                listingData.push({ li, location, price, age, soldOut });
            });

            console.log("[EXT] Unique locations:", [...locations]);
            console.log("[EXT] Unique prices:", [...prices]);
            console.log("[EXT] Unique age ranges:", [...ageRanges]);

            // Step 2: Create a new filter section and add it to the div
            function createFilterSection(title, options, className) {
                // create div for the filter section
                const container = document.createElement("div");
                container.style.marginBottom = "1em";

                // make the label for the filter section
                const label = document.createElement("strong");
                // set the label text
                label.textContent = `${title}: `;
                // add the label to the fliter div
                container.appendChild(label);

                options.forEach(opt => {
                    // check if option is empty or invalid
                    if (!opt || typeof opt !== "string") {
                        console.warn(`[EXT] Skipping invalid option for ${className}:`, opt);
                        return;
                    }

                    const id = `${className}-${opt.replace(/\W+/g, "-")}`;

                    //
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.value = opt;
                    checkbox.id = id;
                    checkbox.className = className;
                    checkbox.style.marginRight = "0.3em";

                    //
                    const optLabel = document.createElement("label");
                    optLabel.textContent = opt;
                    optLabel.setAttribute("for", id);
                    optLabel.style.marginRight = "1em";

                    //
                    container.appendChild(checkbox);
                    container.appendChild(optLabel);
                });

                return container;
            }

            // check if <h2> exists to inject filters, if not log warning and exit


            if (!document.querySelector("h2")) {
                console.warn("[EXT] Couldn't find <h2> to inject filters after.");
                return;
            }

            const h2 = document.querySelector('h2');

            // Create the filter container and append it after the <h2>
            const filterContainer = document.createElement("div");
            filterContainer.style.padding = "1em";
            filterContainer.style.border = "1px solid black";
            filterContainer.style.margin = "1em 0";
            filterContainer.style.backgroundColor = "#f0f0f0";
            filterContainer.style.fontFamily = "sans-serif";

            // Create filter sections for locations
            filterContainer.appendChild(createFilterSection("Location", [...locations], "filter-location"));
// slider
            // Extract all numeric values from price strings
            const numericPrices = [...prices].map(p => {
                    const match = p.match(/\d+(?:\.\d{2})?/);
                    return match ? parseFloat(match[0]) : null;
                }).filter(p => p !== null);

            // grab min and max prices
            const minPrice = Math.min(...numericPrices);
            const maxPrice = Math.max(...numericPrices);
            let currentMax = maxPrice;

            // Create a slider div for price filtering
            const sliderWrapper = document.createElement("div");
            sliderWrapper.style.marginBottom = "1em";
            sliderWrapper.style.display = "flex";

            // Create a label and add it to the slider wrapper
            const priceLabel = document.createElement("strong");
            priceLabel.textContent = `Max Price: $${maxPrice.toFixed(2)} `;
            priceLabel.style.display = "inline-block";
            priceLabel.style.width = "150px";
            priceLabel.style.flexShrink = "0";
            sliderWrapper.appendChild(priceLabel);

            // Create the slider input element
            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = 0;
            slider.max = maxPrice + 0.25; // because of the step size
            slider.step = 0.25;
            slider.value = maxPrice;
            slider.style.cssText = "width: 100%; marginLeft: 10px; marginRight: 10px"; // make it fill the remaining space

            sliderWrapper.appendChild(slider);
            
            filterContainer.appendChild(sliderWrapper);

            

            // Update display on slider change
            slider.addEventListener("input", () => {
                currentMax = parseFloat(slider.value);
                priceLabel.textContent = `Max Price: $${Math.round(slider.value)} `;
                applyFilters();
            });

            const thirdRowContainer = document.createElement("div");
            thirdRowContainer.style.display = "flex";
            thirdRowContainer.style.justifyContent = "start";
            thirdRowContainer.style.marginTop = "1em";
            // Create filter sections for age ranges
            thirdRowContainer.appendChild(createFilterSection("Age", [...ageRanges], "filter-age"));

            // Create a checkbox for sold out listings
            const soldOutCheckbox = document.createElement("input");
            soldOutCheckbox.type = "checkbox";
            soldOutCheckbox.id = "filter-sold-out";
            soldOutCheckbox.checked = false; // default unchecked
            soldOutCheckbox.style.marginLeft = "0.3em";
            const soldOutLabel = document.createElement("strong");
            soldOutLabel.textContent = "Show Sold Out: ";

            thirdRowContainer.appendChild(soldOutLabel);
            thirdRowContainer.appendChild(soldOutCheckbox);
            filterContainer.appendChild(thirdRowContainer);

// add the filter UI to the page
            h2.insertAdjacentElement("afterend", filterContainer);
            console.log("[EXT] Filter UI injected.");

            // Step 3: Apply filter logic
            function applyFilters() {
                const selectedLocations = [...document.querySelectorAll(".filter-location:checked")].map(cb => cb.value);
                // selectedPrices is replaced by price threshold from slider

                const selectedAges = [...document.querySelectorAll(".filter-age:checked")].map(cb => cb.value);

                console.log("[EXT] Applying filters:");
                console.log("Locations:", selectedLocations);
                console.log("Price threshold: ≤", currentMax);
                console.log("Ages:", selectedAges);

                listingData.forEach(({ li, location, price, age, soldOut }) => {
                    if(soldOut && !soldOutCheckbox.checked) {
                        li.style.display = "none"; // hide sold out listings if checkbox is unchecked
                        return;
                    }
                    
                    const matchLocation = selectedLocations.length === 0 || selectedLocations.includes(location);
                    const priceVal = parseFloat((price.match(/\d+(?:\.\d{2})?/) || [])[0]);
                    const matchPrice = isNaN(priceVal) || priceVal <= currentMax;

                    const matchAge = selectedAges.length === 0 || selectedAges.includes(age);

                    li.style.display = (matchLocation && matchPrice && matchAge) ? "list-item" : "none";
                });
            }

            filterContainer.addEventListener("change", applyFilters);
            applyFilters(); // initial filter application
        })();
    } else {
        console.log("[EXT] Extension is disabled.");
    }
});
