import { Route, Routes, BrowserRouter } from "react-router-dom"
import Layout from "./app/layout"
import ConnectionPage from "./pages/ConnectionPage"
import MonitoringPage from "./pages/MonitoringPage"
import HomePage from "./pages/HomePage"
import SessionsPage from "./pages/SessionsPage"
import SessionDetailPage from "./pages/SessionDetailPage"

function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout/>}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/devices" element={<ConnectionPage />} />
                    <Route path="/monitoring" element={<MonitoringPage />} />
                    <Route path='/sessions' element={<SessionsPage />} />
                    <Route path='/sessions/:id' element={<SessionDetailPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default Router