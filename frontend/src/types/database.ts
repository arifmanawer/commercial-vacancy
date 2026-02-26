export type Profile = {
  id: string;
  email: string;
  is_landlord: boolean;
  is_contractor: boolean;
  created_at: string;
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

