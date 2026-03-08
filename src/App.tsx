import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AddToHomeScreen from "@/components/AddToHomeScreen";

import SplashPage from "@/pages/SplashPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import NotFound from "@/pages/NotFound";
import PlaceholderPage from "@/pages/PlaceholderPage";
import MessagesScreen from "@/pages/MessagesScreen";
import JobRatingScreen from "@/pages/JobRatingScreen";
import NotificationsScreen from "@/pages/NotificationsScreen";
import HelpScreen from "@/pages/HelpScreen";
import SettingsScreen from "@/pages/SettingsScreen";
import SharedProfile from "@/pages/SharedProfile";
import OfflinePage from "@/pages/OfflinePage";
import VerifyOtpPage from "@/pages/VerifyOtpPage";
import AddressesPage from "@/pages/AddressesPage";

import WorkerLayout from "@/layouts/WorkerLayout";
import WorkerDashboard from "@/pages/worker/WorkerDashboard";
import WorkerJobs from "@/pages/worker/WorkerJobs";
import WorkerJobDetail from "@/pages/worker/WorkerJobDetail";
import WorkerEarnings from "@/pages/worker/WorkerEarnings";
import WorkerProfile from "@/pages/worker/WorkerProfile";
import WorkerOnboarding from "@/pages/worker/WorkerOnboarding";

import CustomerLayout from "@/layouts/CustomerLayout";
import CustomerDashboard from "@/pages/customer/CustomerDashboard";
import BookService from "@/pages/customer/BookService";
import WorkerSelection from "@/pages/customer/WorkerSelection";
import WorkerPublicProfile from "@/pages/customer/WorkerPublicProfile";
import CustomerBookings from "@/pages/customer/CustomerBookings";
import BookingDetail from "@/pages/customer/BookingDetail";
import PaymentMethods from "@/pages/customer/PaymentMethods";

import WorkerSubscription from "@/pages/worker/WorkerSubscription";
import WorkerInvoice from "@/pages/worker/WorkerInvoice";
import WorkerAvailabilitySettings from "@/pages/worker/WorkerAvailabilitySettings";
import WorkerFeedback from "@/pages/worker/WorkerFeedback";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AddToHomeScreen />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<SplashPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
            <Route path="/offline" element={<OfflinePage />} />
            <Route path="/addresses" element={<AddressesPage />} />

            {/* Worker Onboarding (outside layout shell) */}
            <Route path="/worker/onboarding" element={
              <ProtectedRoute requiredRole="worker"><WorkerOnboarding /></ProtectedRoute>
            } />

            {/* Worker Routes */}
            <Route
              path="/worker"
              element={
                <ProtectedRoute requiredRole="worker">
                  <WorkerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<WorkerDashboard />} />
              <Route path="jobs" element={<WorkerJobs />} />
              <Route path="job/:id" element={<WorkerJobDetail />} />
              <Route path="earnings" element={<WorkerEarnings />} />
              <Route path="subscription" element={<WorkerSubscription />} />
              <Route path="profile" element={<WorkerProfile />} />
              <Route path="availability-settings" element={<WorkerAvailabilitySettings />} />
              <Route path="feedback" element={<WorkerFeedback />} />
            </Route>

            {/* Customer Routes */}
            <Route
              path="/customer"
              element={
                <ProtectedRoute requiredRole="customer">
                  <CustomerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CustomerDashboard />} />
              <Route path="book" element={<BookService />} />
              <Route path="worker-selection" element={<WorkerSelection />} />
              <Route path="worker/:id" element={<WorkerPublicProfile />} />
              <Route path="bookings" element={<CustomerBookings />} />
              <Route path="booking/:id" element={<BookingDetail />} />
              <Route path="payment-methods" element={<PaymentMethods />} />
              <Route path="profile" element={<SharedProfile />} />
            </Route>

            {/* Worker Invoice (outside layout — no bottom nav) */}
            <Route path="/worker/invoice/:id" element={
              <ProtectedRoute requiredRole="worker"><WorkerInvoice /></ProtectedRoute>
            } />

            {/* Shared Routes */}
            <Route path="/messages/:id" element={<MessagesScreen />} />
            <Route path="/rate/:jobId" element={<JobRatingScreen />} />
            <Route path="/notifications" element={<NotificationsScreen />} />
            <Route path="/help" element={<HelpScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/profile" element={<SharedProfile />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
