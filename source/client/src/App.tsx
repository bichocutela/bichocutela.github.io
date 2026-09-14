/** NRD Lojas PWA: experiência mobile alinhada ao aplicativo Android. */
import { lazy, Suspense } from "react";
import ManagementPanelEntry from "@/components/ManagementPanelEntry";
import ProductConsultationEntry from "@/components/ProductConsultationEntry";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const ProductConsultation = lazy(() => import("@/pages/ProductConsultation"));

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/consultar-produtos"} component={ProductConsultation} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <ProductConsultationEntry />
          <ManagementPanelEntry />
          <Suspense fallback={<div className="nrd-status">Carregando...</div>}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
