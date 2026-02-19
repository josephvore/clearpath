import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Search from "./pages/Search";
import ProgramDetail from "./pages/ProgramDetail";
import GuidedFinder from "./pages/GuidedFinder";
import AdminDashboard from "./pages/AdminDashboard";
import NearbyPrograms from "./pages/NearbyPrograms";
import ComparePrograms from "./pages/ComparePrograms";
import BookmarksPage from "./pages/Bookmarks";
import BrowseStates from "./pages/BrowseStates";
import StateDetail from "./pages/StateDetail";
import PublicLayout from "./components/PublicLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={Search} />
      <Route path="/program/:id" component={ProgramDetail} />
      <Route path="/find" component={GuidedFinder} />
      <Route path="/nearby" component={NearbyPrograms} />
      <Route path="/compare" component={ComparePrograms} />
      <Route path="/bookmarks" component={BookmarksPage} />
      <Route path="/browse" component={BrowseStates} />
      <Route path="/programs/:state" component={StateDetail} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/:tab" component={AdminDashboard} />
      <Route path="/404" component={NotFound} />
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
          <PublicLayout>
            <Router />
          </PublicLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
