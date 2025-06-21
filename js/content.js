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

                /* find price
                
                
                if(fullText.includes('$')){

                } else {
                    const price = 'free or unspecified';
                }
                */

                // Try to match prices like "$15", "$25/$30", "$10.50", etc.
                const priceMatch = fullText.match(/\$\d+(?:\.\d{2})?(?:\/\$\d+(?:\.\d{2})?)?/);
                const price = priceMatch ? priceMatch[0] : "free or unspecified";

                locations.add(location);
                prices.add(price);
                ageRanges.add(age);

                listingData.push({ li, location, price, age });
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
            
            // Extract all numeric values from price strings
            const numericPrices = [...prices]
                .map(p => {
                    const match = p.match(/\d+(?:\.\d{2})?/);
                    return match ? parseFloat(match[0]) : null;
                })
                .filter(p => p !== null);

            // grab min and max prices
            const minPrice = Math.min(...numericPrices);
            const maxPrice = Math.max(...numericPrices);
            let currentMax = maxPrice;

            // Create a slider div for price filtering
            const sliderWrapper = document.createElement("div");
            sliderWrapper.style.marginBottom = "1em";

            // Create a label and add it to the slider wrapper
            const priceLabel = document.createElement("strong");
            priceLabel.textContent = `Max Price: $${maxPrice.toFixed(2)} `;
            sliderWrapper.appendChild(priceLabel);

            // Create the slider input element
            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = minPrice;
            slider.max = maxPrice;
            slider.step = 1;
            slider.value = maxPrice;
            slider.style.width = "300px";
            slider.style.marginLeft = "10px";

            // 
            const sliderValueDisplay = document.createElement("span");
            sliderValueDisplay.textContent = `$${maxPrice}`;
            sliderWrapper.appendChild(slider);
            sliderWrapper.appendChild(sliderValueDisplay);

            filterContainer.appendChild(sliderWrapper);

            // Update display on slider change
            slider.addEventListener("input", () => {
                sliderValueDisplay.textContent = `$${slider.value}`;
                currentMax = parseFloat(slider.value);
                applyFilters();
            });

            filterContainer.appendChild(createFilterSection("Age", [...ageRanges], "filter-age"));

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

                listingData.forEach(({ li, location, price, age }) => {
                    const matchLocation = selectedLocations.length === 0 || selectedLocations.includes(location);
                    const priceVal = parseFloat((price.match(/\d+(?:\.\d{2})?/) || [])[0]);
                    const matchPrice = isNaN(priceVal) || priceVal <= currentMax;

                    const matchAge = selectedAges.length === 0 || selectedAges.includes(age);

                    li.style.display = (matchLocation && matchPrice && matchAge) ? "list-item" : "none";
                });
            }

            filterContainer.addEventListener("change", applyFilters);
        })();
    } else {
        console.log("[EXT] Extension is disabled.");
    }
});
