// TODOO: replace these with your actual firebase config values
const config = {
	projectId: "respectively-feedback",
	apiKey: "AIzaSyB-5XBB9HvBGBDClByD_OAFPGmjY-j-XXo",
	storageBucket: "respectively-feedback.appspot.com",
};

window.addEventListener("message", (event) => {
	if (event.data === "init") {
		const app = firebase.initializeApp(config);
		console.log("Initialized Firebase!", app);
	}
});