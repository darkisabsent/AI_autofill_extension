function wrapElement(element, className) {
    const wrapper = document.createElement('div');
    wrapper.className = className;
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
}

export function setupDropdownSearch(selectElement, placeholder) {
    const wrapper = selectElement.parentElement.classList.contains('custom-select-wrapper') ?
        selectElement.parentElement :
        wrapElement(selectElement, 'custom-select-wrapper');
    selectElement.addEventListener('mousedown', (e) => {
        e.preventDefault();
        let searchContainer = wrapper.querySelector('.dropdown-search-container');
        if (!searchContainer) {
            searchContainer = document.createElement('div');
            searchContainer.className = 'dropdown-search-container';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'country-search';
            searchInput.placeholder = placeholder;
            searchContainer.appendChild(searchInput);
            searchContainer.style.position = 'absolute';
            searchContainer.style.top = selectElement.offsetHeight + 'px';
            searchContainer.style.left = '0';
            searchContainer.style.width = '100%';
            searchContainer.style.backgroundColor = '#fff';
            searchContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            searchContainer.style.zIndex = '1000';
            searchContainer.style.padding = '5px';
            searchContainer.style.borderRadius = '4px';
            const dropdownList = document.createElement('div');
            dropdownList.className = 'dropdown-options';
            dropdownList.style.maxHeight = '200px';
            dropdownList.style.overflowY = 'auto';
            searchContainer.appendChild(dropdownList);
            Array.from(selectElement.options).forEach(option => {
                const optionElement = document.createElement('div');
                optionElement.className = 'dropdown-option';
                optionElement.textContent = option.textContent;
                optionElement.dataset.value = option.value;
                optionElement.dataset.search = option.dataset.search;
                optionElement.style.padding = '8px 12px';
                optionElement.style.cursor = 'pointer';
                optionElement.addEventListener('click', () => {
                    selectElement.value = option.value;
                    searchContainer.remove();
                    const event = new Event('change', { bubbles: true });
                    selectElement.dispatchEvent(event);
                });
                dropdownList.appendChild(optionElement);
            });
            searchInput.addEventListener('input', (e) => {
                const searchValue = e.target.value.toLowerCase();
                const options = dropdownList.querySelectorAll('.dropdown-option');
                options.forEach(option => {
                    const isVisible = option.dataset.search && option.dataset.search.includes(searchValue);
                    option.style.display = isVisible || searchValue === '' ? 'block' : 'none';
                });
            });
            document.addEventListener('click', function closeDropdown(e) {
                if (!searchContainer.contains(e.target) && e.target !== selectElement) {
                    searchContainer.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            });
            setTimeout(() => searchInput.focus(), 0);
            wrapper.style.position = 'relative';
            wrapper.appendChild(searchContainer);
        } else {
            searchContainer.remove();
        }
    });
}

export function populateCountryDropdowns(countries) {
    const phoneCountrySelect = document.getElementById('phoneCountryCode');
    const countrySelect = document.getElementById('country');
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.phone_code;
        option.textContent = `${country.phone_code} (${country.code})`;
        option.dataset.search = `${country.phone_code} ${country.code} ${country.name}`.toLowerCase();
        phoneCountrySelect.appendChild(option);
    });
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.name;
        option.textContent = country.name;
        option.dataset.search = country.name.toLowerCase();
        countrySelect.appendChild(option);
    });
    setupDropdownSearch(phoneCountrySelect, 'Rechercher un code pays...');
    setupDropdownSearch(countrySelect, 'Rechercher un pays...');
}

export async function loadCountries() {
    try {
        const response = await fetch('countries.json');
        const data = await response.json();
        populateCountryDropdowns(data);
        return data;
    } catch (error) {
        console.error('Failed to load countries:', error);
        return [];
    }
}
