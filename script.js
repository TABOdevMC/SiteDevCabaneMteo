// Open-Meteo API Configuration (No API key required!)
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const currentLocationBtn = document.getElementById('currentLocationBtn');
const errorMessage = document.getElementById('errorMessage');
const currentWeather = document.getElementById('currentWeather');
const forecast = document.getElementById('forecast');
const loading = document.getElementById('loading');

// Weather code to emoji mapping
const WEATHER_CODES = {
    0: '☀️',      // Clear sky
    1: '🌤️',     // Mainly clear
    2: '⛅',      // Partly cloudy
    3: '☁️',      // Overcast
    45: '🌫️',    // Foggy
    48: '🌫️',    // Depositing rime fog
    51: '🌧️',    // Light drizzle
    53: '🌧️',    // Moderate drizzle
    55: '🌧️',    // Dense drizzle
    61: '🌧️',    // Slight rain
    63: '🌧️',    // Moderate rain
    65: '⛈️',    // Heavy rain
    71: '❄️',    // Slight snow
    73: '❄️',    // Moderate snow
    75: '❄️',    // Heavy snow
    77: '❄️',    // Snow grains
    80: '🌧️',    // Slight rain showers
    81: '🌧️',    // Moderate rain showers
    82: '⛈️',    // Violent rain showers
    85: '❄️',    // Slight snow showers
    86: '❄️',    // Heavy snow showers
    95: '⛈️',    // Thunderstorm
    96: '⛈️',    // Thunderstorm with slight hail
    99: '⛈️'     // Thunderstorm with heavy hail
};

// Weather description mapping
const WEATHER_DESCRIPTIONS = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
};

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});
currentLocationBtn.addEventListener('click', handleCurrentLocation);

/**
 * Handle search button click
 */
function handleSearch() {
    const city = searchInput.value.trim();
    if (!city) {
        showError('Please enter a city name');
        return;
    }
    geocodeCity(city);
}

/**
 * Handle current location button click
 */
function handleCurrentLocation() {
    if (navigator.geolocation) {
        showLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeatherByCoordinates(latitude, longitude);
            },
            (error) => {
                showLoading(false);
                showError('Unable to retrieve your location. Please try searching for a city instead.');
                console.error('Geolocation error:', error);
            }
        );
    } else {
        showError('Geolocation is not supported by your browser');
    }
}

/**
 * Geocode city name to coordinates
 */
function geocodeCity(city) {
    showLoading(true);
    clearError();

    fetch(`${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)
        .then(response => response.json())
        .then(data => {
            if (!data.results || data.results.length === 0) {
                showLoading(false);
                showError('City not found. Please try another search.');
                return;
            }
            
            const result = data.results[0];
            const { latitude, longitude, name, country, admin1 } = result;
            
            // Update city name display
            const cityDisplay = admin1 ? `${name}, ${admin1}, ${country}` : `${name}, ${country}`;
            searchInput.value = cityDisplay;
            
            fetchWeatherByCoordinates(latitude, longitude, cityDisplay);
        })
        .catch(error => {
            showLoading(false);
            showError('Failed to search for city. Please try again.');
            console.error('Geocoding error:', error);
        });
}

/**
 * Fetch weather data by coordinates
 */
function fetchWeatherByCoordinates(lat, lon, cityDisplay = null) {
    showLoading(true);
    clearError();

    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,precipitation,cloud_cover',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
        timezone: 'auto'
    });

    fetch(`${OPEN_METEO_URL}?${params}`)
        .then(response => response.json())
        .then(data => {
            if (!data.current) {
                throw new Error('Failed to fetch weather data');
            }
            displayCurrentWeather(data, cityDisplay);
            displayForecast(data);
            showLoading(false);
        })
        .catch(error => {
            showLoading(false);
            showError('Failed to fetch weather data. Please try again.');
            console.error('Error fetching weather:', error);
        });
}

/**
 * Display current weather information
 */
function displayCurrentWeather(data, cityDisplay) {
    const current = data.current;
    const timezone = data.timezone;

    // Get city name from coordinates if not provided
    if (!cityDisplay) {
        cityDisplay = `${data.latitude.toFixed(2)}°N, ${data.longitude.toFixed(2)}°E`;
    }

    const weatherCode = current.weather_code;
    const weatherEmoji = WEATHER_CODES[weatherCode] || '🌡️';
    const weatherDesc = WEATHER_DESCRIPTIONS[weatherCode] || 'Unknown';

    document.getElementById('cityName').textContent = cityDisplay;
    document.getElementById('weatherDescription').textContent = weatherDesc;
    document.getElementById('temp').textContent = Math.round(current.temperature_2m);
    document.getElementById('feelsLike').textContent = Math.round(current.apparent_temperature);
    document.getElementById('humidity').textContent = current.relative_humidity_2m;
    document.getElementById('windSpeed').textContent = Math.round(current.wind_speed_10m);
    document.getElementById('pressure').textContent = Math.round(current.pressure_msl);
    document.getElementById('precipitation').textContent = current.precipitation || 0;
    document.getElementById('cloudCover').textContent = current.cloud_cover;
    document.getElementById('weatherIcon').textContent = weatherEmoji;

    currentWeather.classList.remove('hidden');
}

/**
 * Display 7-day forecast
 */
function displayForecast(data) {
    const daily = data.daily;
    const forecastCards = document.getElementById('forecastCards');
    forecastCards.innerHTML = '';

    // Create forecast cards for next 7 days
    for (let i = 0; i < daily.time.length; i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        
        const weatherCode = daily.weather_code[i];
        const weatherEmoji = WEATHER_CODES[weatherCode] || '🌡️';
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        
        const card = document.createElement('div');
        card.className = 'forecast-card';
        
        card.innerHTML = `
            <div class="date">${dayName}</div>
            <div class="forecast-icon">${weatherEmoji}</div>
            <div class="forecast-temp">${maxTemp}°</div>
            <div class="forecast-min">${minTemp}°</div>
        `;
        
        forecastCards.appendChild(card);
    }

    forecast.classList.remove('hidden');
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

/**
 * Clear error message
 */
function clearError() {
    errorMessage.classList.remove('show');
    errorMessage.textContent = '';
}

/**
 * Show/hide loading spinner
 */
function showLoading(show) {
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

/**
 * Initialize app
 */
function init() {
    console.log('CabaneMeteo initialized - Using Open-Meteo API (no API key required!)');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);