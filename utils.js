let map = null;

//Using leaflet library to call up a map at the requested lat and lon
export function initMap(latitude, longitude) {
  if (!map) {
    map = L.map("map").setView([latitude, longitude], 15);

    // Add the tile layer from OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
  } else {
    // If the map is already initialized, update its center and marker
    map.setView([latitude, longitude], 15);
    L.marker([latitude, longitude]).addTo(map);
  }
}

//Checks if a string contains numbers and if so, assumes it's a postcode.
//This is not a robust check and is only meant as an example.
export function hasNumbers(string) {
  return /\d/.test(string);
}

//Get the user's current location
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}

//get data to display for today
//"Today" data displays from current time plus the next three 3-hourly period
export function getDatatoDisplay(cityInfo, weatherInfo) {
  let todayTime = [];
  let todayTemp = [];
  let todayDesc = [];
  let todayImg = [];
  let h = 0;

  for (h = 0; h <= 3; h++) {
    //gather the data for each of the four time slots for the first day
    todayTime.push(getLocalTime(cityInfo, weatherInfo, h));
    todayTemp.push(weatherInfo[h].main.temp);
    todayDesc.push(weatherInfo[h].weather[0].description);
    todayImg.push(weatherInfo[h].weather[0].icon);
  }
  return [todayTime, todayTemp, todayDesc, todayImg];
}

//Used for TODAY data - converts the displayed hourly datapoints from UTC to the local time of the city
export function getLocalTime(cityInfo, weatherInfo, h) {
  const timeZoneOffsetMinutes = cityInfo.timezone / 60; // convert seconds to minutes
  const dt = new Date(weatherInfo[h].dt_txt);

  // Adjust for daylight saving time
  const isDST = () => {
    const januaryOffset = new Date(dt.getFullYear(), 0, 1).getTimezoneOffset();
    const julyOffset = new Date(dt.getFullYear(), 6, 1).getTimezoneOffset();
    return Math.min(januaryOffset, julyOffset) === dt.getTimezoneOffset();
  };

  const dstOffset = isDST() ? 60 : 0; // DST offset is 60 minutes

  const newTime = dt.setMinutes(
    dt.getMinutes() + timeZoneOffsetMinutes - dstOffset
  );
  const dateObject = new Date(newTime);
  // console.log("dateObject", dateObject);

  const dayOfWeek = dateObject.toLocaleString("en-US", { weekday: "long" });
  const dayOfMonth = dateObject.getDate();
  const month = dateObject.toLocaleString("en-US", { month: "long" });
  const time = dateObject.toLocaleString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });

  return [dayOfWeek, dayOfMonth, month, time];
}

//format the days nicely for display
export function getDate(dateString) {
  // put the dates in the right format for display
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function getSuffix(dayNum) {
    //convert number to a string and reverse the order for evaluation
    const evalNum = JSON.stringify(dayNum).split("").reverse();
    if (evalNum[1] != "1") {
      //exclude teen numbers
      switch (evalNum[0]) {
        case "1":
          return "st";
        case "2":
          return "nd";
        case "3":
          return "rd";
      }
    }
    return "th";
  }

  //convert the date to friendly format for display
  const forecastTime = dateString.split(" ")[1].slice(0, -3);
  const date = new Date(dateString);
  const dayMonth = monthNames[date.getMonth()];
  const dayName = daysOfWeek[date.getDay()];
  const dayNum = date.getDate();
  const suffix = getSuffix(dayNum);

  return [dayName, dayNum + suffix, dayMonth, forecastTime];
}

//get the real current local time of the city - used for Today
export function getCalculateLocalTime(timezone) {
  const timezoneOffsetMilliseconds = timezone * 1000;
  const currentUtcTime = new Date();

  // Calculate the local time by adding the timezone offset to the UTC time
  const currentLocalTime = new Date(
    currentUtcTime.getTime() + timezoneOffsetMilliseconds
  );

  const formattedLocalTime = currentLocalTime.toLocaleTimeString("en-US", {
    hour12: true,
    timeZone: "UTC",
    hour: "numeric",
    minute: "numeric",
  });

  return [formattedLocalTime];
}

//convert API weatherdata to timezone of retrieved city
export function convertAPIDataToCityTime(result) {
  //no need to convert UK
  if (result.data.city.timezone === 3600) {
    const convertedResult = result.data.list;
    return convertedResult;
  }

  const timezoneOffsetSeconds = result.data.city.timezone;
  const convertedResult = JSON.parse(JSON.stringify(result.data.list));

  // loop through and convert each UTC timestamp to local time
  for (const dataPoint of convertedResult) {
    const utcTimestamp = dataPoint.dt;
    const localTimestamp = utcTimestamp + timezoneOffsetSeconds;
    const localTime = new Date(localTimestamp * 1000);

    // account for daylight saving
    const isDST = () => {
      const january = new Date(localTime.getFullYear(), 0, 1);
      const july = new Date(localTime.getFullYear(), 6, 1);
      const stdTimezoneOffset = Math.max(
        january.getTimezoneOffset(),
        july.getTimezoneOffset()
      );
      return localTime.getTimezoneOffset() < stdTimezoneOffset;
    };

    if (isDST()) {
      localTime.setHours(localTime.getHours() - 1); //subtract an hour
    }

    // update dt with the converted local timestamp
    dataPoint.dt = localTime.getTime() / 1000;

    // update dt_txt with the converted local date and time string
    const localDate = localTime.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const localTimeStr = localTime.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dataPoint.dt_txt = `${localDate} ${localTimeStr}`;
  }

  return convertedResult;
}

//when the exact timeslots of 9, 12, 18, 21 are not available, find the nearest time instead within 90 mins.
export function getClosestTime(time1, time2) {
  const [hours1, minutes1] = time1.split(":").map(Number);
  const [hours2, minutes2] = time2.split(":").map(Number);

  const time1InMinutes = hours1 * 60 + minutes1;
  const time2InMinutes = hours2 * 60 + minutes2;

  const timeDifference = Math.abs(time1InMinutes - time2InMinutes);

  return timeDifference <= 90;
}
