import {
  initMap,
  hasNumbers,
  getCurrentLocation,
  getDatatoDisplay,
  getDate,
  getCalculateLocalTime,
  convertAPIDataToCityTime,
  getClosestTime,
} from "./utils.js";

//DOM declarations
const domSearchForThis = document.getElementById("searchForThis"); //input box
const domPlaceList = document.getElementById("placeList"); //dropdown box
const domContent = document.getElementById("resultsContent"); //weather result cards
const domLocation = document.getElementById("location"); // display selected location.
const domCurrentLocation = document.getElementById("searchCurrentLocation"); //current location
const domShowError = document.getElementById("showError");
const domCurrentLocalTime = document.getElementById("currentLocalTime");

//show a placeholder map when the page loads (North Pole)
const placeholderLatitude = 55.9486;
const placeholderLongitude = -3.1999;
initMap(placeholderLatitude, placeholderLongitude);

//get weather by current location
domCurrentLocation.addEventListener("click", getCurrentLocationWeather);

async function getCurrentLocationWeather() {
  try {
    const location = await getCurrentLocation();
    const { latitude, longitude } = location.coords;
    getWeatherData("", latitude, longitude);
  } catch (error) {
    console.log(error);
    domShowError.innerHTML =
      "Sorry, you denied access to your location - enter a place instead!";
  }
}

// Identify if input is a postcode or a city by checking for numbers
// Okay for now but will need to implement a stronger check if developing this app further
if (domSearchForThis) {
  domSearchForThis.addEventListener("input", searchLocation);
}

// Clear the dropdown and error box when the search box is clicked
if (domSearchForThis) {
  domSearchForThis.addEventListener("click", clearDropdown);
}

// Function to clear the dropdown content
function clearDropdown() {
  domPlaceList.innerHTML = "";
  domShowError.innerHTML = "";
}

//include small delay before populating dropdown, in case user is typing a postcode
let searchTimeoutId;

async function searchLocation(e) {
  clearTimeout(searchTimeoutId); // Clear any previous timeouts
  searchTimeoutId = setTimeout(async () => {
    const thisLocation = e.target.value;
    if (hasNumbers(thisLocation)) {
      domPlaceList.innerHTML = "";
      // Check if the input contains a comma followed by a country code
      if (!thisLocation.includes(",")) {
        domShowError.innerHTML =
          "Required Format: Postcode + comma + Country code (eg W7, GB)";
        return;
      } else if (thisLocation.includes(",")) {
        domShowError.innerHTML = ""; //clear error message
      }

      const isPostCode = thisLocation.replace(/\s+/g, "");
      try {
        await getLocationByPostCode(isPostCode);
      } catch (error) {
        console.log("Failed to get location by postcode.");
      }
    } else {
      try {
        await getLocationByName(thisLocation);
      } catch (error) {
        console.log("Failed to get location by name.");
      }
    }
  }, 200);
}

//geocode the postcode and pass to the getWeatherData function as soon as correct postcode format is found
async function getLocationByPostCode(isPostCode) {
  try {
    const placeByPostCode = await axios.get(
      `https://api.openweathermap.org/geo/1.0/zip?zip=${isPostCode}&appid=37a8ca60977c4797af8fb420cfec3c2c`
    );
    const { name, lat, lon } = placeByPostCode.data;
    getWeatherData(name, lat, lon);
  } catch (error) {
    if (isEnterPressed) {
      domShowError.innerHTML = "Invalid search";
    }
    return;
  }
}

//event listener tracks if user pressed enter with incorrect postcode format
let isEnterPressed = false;
document.getElementById("searchBox").addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    isEnterPressed = true;
    const searchValue = event.target.value.trim();
    getLocationByPostCode(searchValue);
  } else {
    isEnterPressed = false;
  }
});

// show a list of matching cities in the dropdown while user is typing and send the clicked city to the getWeatherData function
async function getLocationByName(thisLocation) {
  try {
    const place = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${thisLocation}&limit=5&appid=37a8ca60977c4797af8fb420cfec3c2c`
    );
    const locResults = place.data;
    let placesDropdown = locResults
      .map(
        (result) =>
          `<li class="location-list-item" data-lat="${result.lat}" data-lon="${result.lon}">${result.name}, ${result.state}, ${result.country}</li>`
      )
      .join("");
    // Clear the dropdown before updating it with new results
    domPlaceList.innerHTML = "";

    domPlaceList.innerHTML = `<ul>${placesDropdown}</ul>`;
    // Show dropdown
    domPlaceList.classList.add("show");

    const listItems = domPlaceList.querySelectorAll(".location-list-item");
    listItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        const selectedCity = item.innerText.split(",")[0];
        const selectedCityLat = item.dataset.lat;
        const selectedCityLon = item.dataset.lon;

        getWeatherData(selectedCity, selectedCityLat, selectedCityLon);
      });
    });
  } catch (error) {
    // Hide dropdown
    const domPlaceList = document.getElementById("placeList");
    domPlaceList.classList.remove("show");
    console.log("invalid location");
  }
}

// Get the weather
//city included because search-by-postcode needs it
async function getWeatherData(city, latitude, longitude) {
  //unhide the weather cards to display weather
  domContent.style.display = "block";

  //clear any error message
  domShowError.innerHTML = "";

  //show location on map
  initMap(latitude, longitude);

  //retrieve 3-hourly data for 5 days
  const result = await axios.get(
    `https://api.openweathermap.org/data/2.5/forecast?&lat=${latitude}&lon=${longitude}&APPID=37a8ca60977c4797af8fb420cfec3c2c&units=metric&cnt=48`
  );

  console.log(result);

  //clear input field
  document.getElementById("searchBox").value = "";

  //data retrieved in in UTC time so converting to the retrieved city's local time
  const convertedResult = convertAPIDataToCityTime(result);
  // console.log("converted result", convertedResult);

  const cityInfo = result.data.city;
  const weatherInfo = result.data.list;
  const allDates = []; //list of all 40 dates from the API
  const _09Data = []; //9am data for 5 days
  const _12Data = []; //12pm data for 5 days
  const _18Data = []; //6pm data for 5 days
  const _21Data = []; //9pm data for 5 days

  //Get data for today
  //Current day always displays current time plus next three 3-hourly periods
  let parseData = [];
  const [todayTime, todayTemp, todayDesc, todayImg] = getDatatoDisplay(
    cityInfo,
    weatherInfo
  );

  //update the webpage with the data that has been returned for the current day
  let t = 0; //counter for the four 3-hourly datapoints
  for (t = 0; t <= 3; t++) {
    parseData.push([todayTime[t], todayTemp[t], todayDesc[t], todayImg[t]]);
  }
  //display the data for each time slot on the first day
  t = 0;
  for (t = 0; t <= 3; t++) {
    let htmlTime = ` ${parseData[t][0][3]}`;
    let htmlDay0 = ` ${parseData[t][0][0]}, ${parseData[t][0][1]} ${parseData[t][0][2]}`;
    let htmlTemp = ` ${Math.round(parseData[t][1])} C `;
    let htmlDesc = ` ${parseData[t][2]} `;
    let htmlImg = ` <img src = "https://openweathermap.org/img/wn/${parseData[t][3]}@4x.png" >`;

    document.getElementById(`forecastDay${t}`).innerHTML = htmlDay0;
    document.getElementById(`forecastTime${t}`).innerHTML = htmlTime;
    document.getElementById(`forecastTemp${t}`).innerHTML = htmlTemp;
    document.getElementById(`forecastDesc${t}`).innerHTML = htmlDesc;
    document.getElementById(`forecastImg${t}`).innerHTML = htmlImg;
  }

  //Get Rest of Week
  //API doesn't have enough datapoints to guarantee availability of 9am, 12pm, 6pm, 9pm at city's local time
  //so we'll get the closest datapoint to those times (within 90 minutes)
  let i = 0;
  for (convertedResult[i].dt_txt; i <= 39; ) {
    allDates.push(convertedResult[i].dt_txt);
    //proceed if the data is not from today
    if (
      convertedResult[0].dt_txt.split(" ")[0] !==
      convertedResult[i].dt_txt.split(" ")[0]
    ) {
      //push to array if datapoint matches the time we want or is close to it
      if (
        convertedResult[i].dt_txt.split(" ")[1] === "09:00:00" ||
        getClosestTime(convertedResult[i].dt_txt.split(" ")[1], "09:00:00")
      ) {
        _09Data.push([
          convertedResult[i],
          convertedResult.indexOf(convertedResult[i], 0),
        ]);
      } else if (
        convertedResult[i].dt_txt.split(" ")[1] === "12:00:00" ||
        getClosestTime(convertedResult[i].dt_txt.split(" ")[1], "12:00:00")
      ) {
        _12Data.push([
          convertedResult[i],
          convertedResult.indexOf(convertedResult[i], 0),
        ]);
      } else if (
        convertedResult[i].dt_txt.split(" ")[1] === "18:00:00" ||
        getClosestTime(convertedResult[i].dt_txt.split(" ")[1], "18:00:00")
      ) {
        _18Data.push([
          convertedResult[i],
          convertedResult.indexOf(convertedResult[i], 0),
        ]);
      } else if (
        convertedResult[i].dt_txt.split(" ")[1] === "21:00:00" ||
        getClosestTime(convertedResult[i].dt_txt.split(" ")[1], "21:00:00")
      ) {
        _21Data.push([
          convertedResult[i],
          convertedResult.indexOf(convertedResult[i], 0),
        ]);
      }
    }
    i = i + 1;
  }

  let z = 0;
  // let index = 0;
  for (z = 0; z <= 3; z++) {
    updateRestOfWeek(_09Data, z, 0);
  }

  for (z = 0; z <= 3; z++) {
    updateRestOfWeek(_12Data, z, 12);
  }

  for (z = 0; z <= 3; z++) {
    updateRestOfWeek(_18Data, z, 18);
  }

  for (z = 0; z <= 3; z++) {
    updateRestOfWeek(_21Data, z, 21);
  }

  //display the data for Rest of Week (excluding current day)
  function updateRestOfWeek(timePeriod, z, timeslot) {
    let friendlyLocalTime = getDate(timePeriod[z][0].dt_txt);
    let displayDay = friendlyLocalTime[0] + " " + friendlyLocalTime[1];
    let displayTime = friendlyLocalTime[3];

    let tempDate = "forecastDate" + z + timeslot;
    let tempTime = "forecastTime" + z + timeslot;
    let tempField = "forecastTemp" + z + timeslot;
    let descField = "forecastDesc" + z + timeslot;
    let descImg = "forecastImg" + z + timeslot;

    let img = timePeriod[z][0].weather[0].icon;

    let htmlDay = ` ${displayDay} `;
    let htmlTime = ` ${displayTime} `;
    let htmlTemp = ` ${Math.round(timePeriod[z][0].main.temp)} C `;
    let htmlDesc = ` ${timePeriod[z][0].weather[0].description} `;
    let htmlImg = ` <img src = "https://openweathermap.org/img/wn/${img}@4x.png" >`;
    document.getElementById(tempDate).innerHTML = htmlDay;
    document.getElementById(tempTime).innerHTML = htmlTime;
    document.getElementById(tempField).innerHTML = htmlTemp;
    document.getElementById(descField).innerHTML = htmlDesc;
    document.getElementById(descImg).innerHTML = htmlImg;

    //hide the dropdown
    domPlaceList.classList.remove("show");
  }

  let localTime = getCalculateLocalTime(cityInfo.timezone);

  ///Display the city name and current date and time
  domLocation.innerHTML = `${cityInfo.name}, ${cityInfo.country}`;
  domCurrentLocalTime.innerHTML = `Local Time: ${localTime}`;
}
