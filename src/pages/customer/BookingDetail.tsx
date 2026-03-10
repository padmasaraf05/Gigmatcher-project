// src/pages/customer/BookingDetail.tsx
// [FIX Issue 4] Worker avatar in booking detail showed initial letter only.
//   OLD: <div ...>{booking.workerName.charAt(0)}</div>
//   FIX: renders <img> when booking.workerPhoto is non-empty, falls back to initial.
//   booking.workerPhoto already populated by useBookingDetail via
//   profiles!worker_id(profile_photo_url) in useCustomerApi.ts — no hook change needed.
//   ALL other JSX, Tailwind classes, layout — IDENTICAL to previous version.

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBookingDetail, useCancelBooking, useSubmitReview } from "@/hooks/useCustomerApi";
import { StatusTimeline } from "@/components/StatusComponents";
import LiveLocationMap from "@/components/LiveLocationMap";
import { type JobStatus } from "@/lib/jobStateMachine";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import LoadingButton from "@/components/LoadingButton";
import {
  Star, Phone, MessageCircle, MapPin, Navigation, ChevronLeft, ImageIcon, X,
} from "lucide-react";
import PaymentInfoCard from "@/components/PaymentInfoCard";
import { toast } from "@/hooks/use-toast";

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: booking, isLoading } = useBookingDetail(id || "");
  const cancelBooking = useCancelBooking();
  const submitReview = useSubmitReview();

  const [showCancel, setShowCancel]   = useState(false);
  const [rating, setRating]           = useState(0);
  const [comment, setComment]         = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!booking) {
    return <div className="px-4 py-10 text-center"><p className="text-muted-foreground">Booking not found</p></div>;
  }

  const isLiveTracking = booking.status === "en_route" || booking.status === "in_progress";

  const handleGetDirections = () => {
    let url: string;
    if (booking.latitude && booking.longitude) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(booking.address)}`;
    }
    window.open(url, "_blank");
  };

  const handleCallWorker = () => {
    if (booking.workerPhone) {
      window.location.href = `tel:${booking.workerPhone}`;
    } else {
      toast({
        title: "Phone number unavailable",
        description: "Worker's phone number is not on record.",
      });
    }
  };

  const handleCancel = async () => {
    await cancelBooking.mutateAsync(booking.id);
    setShowCancel(false);
    toast({ title: "Booking cancelled" });
    navigate("/customer/bookings");
  };

  const handleReview = async () => {
    if (rating === 0) { toast({ title: "Please select a rating" }); return; }
    await submitReview.mutateAsync({ bookingId: booking.id, rating, comment });
    toast({ title: "Review submitted! ⭐", description: "Thanks for your feedback" });
  };

  const photoUrls: string[] = booking.photoUrls ?? [];

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in pb-8">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="touch-target flex items-center gap-1 text-sm font-semibold text-primary">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      {/* Status Timeline */}
      <StatusTimeline status={booking.status as JobStatus} />

      {/* Worker Info */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        {/* [FIX Issue 4] Show photo if available, initial letter fallback */}
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0 overflow-hidden">
          {booking.workerPhoto ? (
            <img src={booking.workerPhoto} alt={booking.workerName} className="h-full w-full object-cover" />
          ) : (
            booking.workerName.charAt(0)
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground">{booking.workerName}</h3>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
            <span>{booking.workerRating}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCallWorker}
            className="touch-target h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center transition-default hover:bg-primary/20"
          >
            <Phone className="h-5 w-5 text-primary" />
          </button>
          <button
            onClick={() => navigate(`/messages/${id}`)}
            className="touch-target h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center transition-default hover:bg-primary/20"
          >
            <MessageCircle className="h-5 w-5 text-primary" />
          </button>
        </div>
      </div>

      {/* Job Details */}
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Job Details</h4>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">{booking.serviceType}</span>
          </div>
          <p className="text-sm text-muted-foreground">{booking.description}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{booking.address}</span>
          </div>
          <p className="text-xs text-muted-foreground">{booking.date} • {booking.time}</p>
        </div>
      </div>

      {/* Customer-uploaded photos gallery */}
      {photoUrls.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-bold text-foreground">Job Photos</h4>
            <span className="text-xs text-muted-foreground">({photoUrls.length})</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photoUrls.map((url, i) => (
              <button
                key={i}
                onClick={() => setLightboxUrl(url)}
                className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:opacity-90 transition-opacity"
              >
                <img src={url} alt={`Job photo ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      {isLiveTracking ? (
        <LiveLocationMap jobId={id!} isTracking={true} address={booking.address} />
      ) : (
        <div className="space-y-2">
          <div className="relative h-36 rounded-xl bg-muted border border-border flex items-center justify-center">
            <MapPin className="h-8 w-8 text-primary" />
            <span className="absolute bottom-2 left-3 bg-card rounded-lg px-3 py-1 text-xs font-medium text-foreground shadow-sm border border-border">
              📍 {booking.address}
            </span>
          </div>
          <button
            onClick={handleGetDirections}
            className="touch-target w-full flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-semibold text-primary transition-default hover:bg-primary/5"
          >
            <Navigation className="h-4 w-4" /> Get Directions
          </button>
        </div>
      )}

      {/* Payment */}
      <PaymentInfoCard
        bookingId={booking.id}
        serviceCharge={booking.payment}
        paymentMethod={booking.paymentMethod}
        paymentStatus={booking.paymentStatus === "refunded" ? "failed" : booking.paymentStatus}
      />

      {/* Cancel (pending only) */}
      {booking.status === "pending" && (
        <button
          onClick={() => setShowCancel(true)}
          className="touch-target w-full rounded-lg border-2 border-destructive py-3 text-sm font-semibold text-destructive transition-default hover:bg-destructive/5"
        >
          Cancel Booking
        </button>
      )}

      {/* Rate & Review (completed only) */}
      {booking.status === "completed" && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-foreground">Rate & Review</h4>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)} className="touch-target p-1">
                <Star className={`h-8 w-8 transition-all duration-200 ${
                  s <= rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"
                }`} />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Share your experience..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <LoadingButton loading={submitReview.isPending} onClick={handleReview}>
            Submit Review
          </LoadingButton>
        </div>
      )}

      {/* Cancel Bottom Sheet */}
      {showCancel && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/30 animate-fade-in" onClick={() => setShowCancel(false)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-card rounded-t-2xl border-t border-border p-5 animate-slide-up">
            <h3 className="text-base font-bold text-foreground mb-2">Cancel Booking?</h3>
            <p className="text-sm text-muted-foreground mb-4">This will cancel your booking with {booking.workerName}. You may be charged a cancellation fee.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancel(false)}
                className="flex-1 touch-target rounded-lg border border-border py-3 text-sm font-semibold text-foreground transition-default hover:bg-muted"
              >
                Keep Booking
              </button>
              <LoadingButton
                variant="primary"
                className="flex-1 !bg-destructive"
                loading={cancelBooking.isPending}
                onClick={handleCancel}
              >
                Cancel
              </LoadingButton>
            </div>
          </div>
        </>
      )}

      {/* Full-screen photo lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}