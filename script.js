// Constructing base error
class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Inheriting AppError attributes for Custom Errors
class NetworkError extends AppError {}
class DataFetchError extends AppError {}
class MapInitializationError extends AppError {}
class FetchAccidentsError extends AppError {}

// Define a mapping from error constructors to error messages
const errorMessageMapping = {
  [NetworkError.name]: "Network issue, please try again later.",
  [DataFetchError.name]: "Problem fetching data.",
  [MapInitializationError.name]: "Failed to initialize the map.",
  [FetchAccidentsError.name]: "Could not load accident data.",
};

function handleError(error) {
  // Use the name of the error's constructor to get a specific message or use a generic message
  const message =
    errorMessageMapping[error.name] || "An unexpected error occurred.";
  displayUserErrorMessage(message);
}

function displayUserErrorMessage(message) {
  let errorContainer = document.getElementById("error-message-container");

  // If the error container does not exist, create it and append it to the body
  if (!errorContainer) {
    errorContainer = document.createElement("div");
    errorContainer.id = "error-message-container";
    document.body.appendChild(errorContainer);
    errorContainer.style =
      "position: fixed; top: 0; left: 0; width: 100%; background: rgba(255, 0, 0, 0.7); color: white; text-align: center; padding: 10px; box-sizing: border-box; z-index: 1000;";
  }

  errorContainer.setAttribute("role", "alert");

  // Set the error message
  errorContainer.innerHTML = `<div class="error-message" style="padding: 10px; margin: 10px 0; border-radius: 5px; background: #ffd1d1; color: red;">${message}</div>`;

  // Make the container visible
  errorContainer.style.display = "block";
}

document.addEventListener("DOMContentLoaded", function () {
  fetchAWSCredentialsAndInitializeMap()
    .then(() => {
      // Initialization complete
    })
    .catch((error) => {
      handleError(error);
    });
});

// Fetches AWS credentials and initializes the map
async function fetchAWSCredentialsAndInitializeMap() {
  try {
    const credentialsResponse = await fetch(
      "https://avalanchebackend.onrender.com/api/aws-credentials/"
    );
    if (!credentialsResponse.ok) {
      throw new NetworkError(
        `HTTP error! status: ${credentialsResponse.status}`
      );
    }
    const { identityPoolId, region, mapName } =
      await credentialsResponse.json();

    initializeMap(identityPoolId, region, mapName);
  } catch (error) {
    if (error instanceof NetworkError) {
      // Handle network errors here, possibly re-throwing as a more specific error if needed
      throw new DataFetchError("Failed to fetch AWS credentials.");
    } else {
      throw error; // Re-throw other errors unchanged
    }
  }
}

// Initializes the map and adds markers for each accident
async function initializeMap(identityPoolId, region, mapName) {
  try {
    // Correctly using `withIdentityPoolId` as per the provided documentation
    const authHelper = await amazonLocationAuthHelper.withIdentityPoolId(
      identityPoolId
    );

    const map = new maplibregl.Map({
      container: "map",
      style: `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor`,
      center: [-98.5795, 39.8283],
      zoom: 4,
      ...authHelper.getMapAuthenticationOptions(),
    });

    map.addControl(new maplibregl.NavigationControl(), "top-left");

    let accidents = localStorage.getItem("accidentsData");
    if (accidents) {
      accidents = JSON.parse(accidents);
      addAccidentsToMap(accidents, map);
    } else {
      await fetchAccidentsData(map);
    }
  } catch (error) {
    // Assuming handleError is a function that handles errors appropriately
    handleError(new MapInitializationError("Map initialization failed."));
  }
}

// Fetches accidents data from the backend and caches it
async function fetchAccidentsData(map) {
  try {
    const response = await fetch(
      "https://avalanchebackend.onrender.com/api/accidents/"
    );
    if (!response.ok) {
      throw new FetchAccidentsError(`HTTP error! status: ${response.status}`);
    }
    const accidents = await response.json();

    localStorage.setItem("accidentsData", JSON.stringify(accidents));
    addAccidentsToMap(accidents, map);
  } catch (error) {
    handleError(error);
  }
}

// Adds markers to the map for each accident, ensuring valid latitude and longitude
function addAccidentsToMap(accidents, map) {
  accidents.forEach((accident) => {
    const longitude = accident.longitude;
    const latitude = accident.latitude;

    new maplibregl.Marker()
      .setLngLat([longitude, latitude])
      .setPopup(
        new maplibregl.Popup({ offset: 25 }).setHTML(
          `<h3>${accident.location}</h3><p>${accident.description}</p><p>Date: ${accident.date}</p>`
        )
      )
      .addTo(map);
  });
}
