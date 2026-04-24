export default {
  expo: {
    owner: "julienmorin",
    name: "Floc",
    slug: "floc",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#181410"
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.julienmorin.floc",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Floc uses your location to show nearby runs on the map."
      }
    },
    android: {
      package: "com.julienmorin.floc"
    },
    plugins: [
      "expo-secure-store",
      "expo-font",
      "@react-native-community/datetimepicker",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#C24A2E",
          "sounds": []
        }
      ]
    ],
    extra: {
      googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY,
      eas: {
        projectId: "339f3fa2-eb0b-4198-8328-0e6d6caf6825"
      }
    }
  }
}