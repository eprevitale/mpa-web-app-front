import { Route, Routes, BrowserRouter } from "react-router-dom"
import Monitoring from "./pages/Monitoring"
import Layout from "./app/layout"

function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout/>}>
                    <Route path="/" element={<Monitoring />} />
                    // adicionar outras rotas aqui
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default Router