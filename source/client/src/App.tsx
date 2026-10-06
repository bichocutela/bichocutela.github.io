/** NRD Lojas PWA: experiência mobile alinhada ao aplicativo Android. */
import { lazy, Suspense } from "react";
import ManagementPanelEntry from "@/components/ManagementPanelEntry";
import { PwaProvider, usePwaVisibility } from "@/contexts/PwaContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const ProductConsultation = lazy(() => import("@/pages/ProductConsultation"));

function ConsultationRoute() {
  const { priceConsultation } = usePwaVisibility();
  return priceConsultation ? <ProductConsultation /> : <Home />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/consultar-produtos"} component={ConsultationRoute} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <PwaProvider><ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <ManagementPanelEntry />
          <Suspense fallback={<div className="nrd-status">Carregando...</div>}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider></PwaProvider>
    </ErrorBoundary>
  );
}

export default App;
