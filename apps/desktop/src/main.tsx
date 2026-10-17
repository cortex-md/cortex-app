import ReactDOM from "react-dom/client"
import { initRenderer } from "./bootstrap/initRenderer"
import "./styles/index.css"

initRenderer()

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)

void import("./App").then(({ default: App }) => root.render(<App />))
