import ReactDOM from "react-dom/client"
import { initRenderer } from "./bootstrap/initRenderer"
import "./styles/index.css"

initRenderer()

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)

if (new URLSearchParams(window.location.search).get("window") === "settings") {
	void import("./settings-window/SettingsWindowApp").then(({ SettingsWindowApp }) =>
		root.render(<SettingsWindowApp />),
	)
} else {
	void import("./App").then(({ default: App }) => root.render(<App />))
}
