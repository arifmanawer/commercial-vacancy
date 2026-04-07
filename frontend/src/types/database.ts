export type Profile = {
  id: string;
  email: string;
  is_landlord: boolean;
  is_contractor: boolean;
  created_at: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  address?: string | null;
  description?: string | null;
  profile_picture_url?: string | null;
};

export type ContractorAvailabilityStatus = "available" | "soon" | "busy";

export type Contractor = {
  id: string;
  user_id: string;
  business_name: string;
  profile_picture_url: string | null;
  services: string[];
  hourly_rate: number;
  service_radius: number;
  rating: number;
  total_jobs_completed: number;
  is_verified: boolean;
  availability: {
    status: ContractorAvailabilityStatus;
    available_days: string[];
  };
};

export type ContractorJobStatus =
  | "requested"
  | "accepted"
  | "declined"
  | "completed";

export type ContractorJob = {
  id: string;
  landlord_id: string;
  contractor_id: string;
  listing_id: string | null;
  title: string;
  description: string | null;
  budget: number | null;
  preferred_date: string | null;
  status: ContractorJobStatus;
  landlord_note: string | null;
  contractor_note: string | null;
  created_at: string;
  updated_at: string;
};

export type Review = {
  id: string;
  target_user_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  role_context: "landlord" | "contractor" | "renter";
  rating: number;
  content: string;
  created_at: string;
};
