import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ItineraryCardProps {
  trip: {
    id: string;
    destination: string;
    interests: string[];
    start_date: string;
    end_date: string;
    itinerary: any;
    created_at: string;
  };
  onDelete: () => void;
}

const ItineraryCard = ({ trip, onDelete }: ItineraryCardProps) => {
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from("trips").delete().eq("id", trip.id);

      if (error) throw error;

      toast({
        title: "Trip deleted",
        description: "Your trip has been removed.",
      });

      onDelete();
    } catch (error: any) {
      console.error("Error deleting trip:", error);
      toast({
        title: "Error",
        description: "Failed to delete trip. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <MapPin className="h-5 w-5 text-primary" />
              {trip.destination}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {trip.interests.map((interest, idx) => (
            <Badge key={idx} variant="secondary">
              {interest}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Itinerary Highlights
          </h4>
          <div className="space-y-3">
            {trip.itinerary.days?.slice(0, 3).map((day: any, idx: number) => (
              <div key={idx} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Day {day.day}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {day.activities?.[0]?.name || day.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {trip.itinerary.days?.length > 3 && (
            <p className="text-sm text-muted-foreground text-center">
              + {trip.itinerary.days.length - 3} more days
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ItineraryCard;