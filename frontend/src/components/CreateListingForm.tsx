
"use client";
import { useState } from "react";

// Property type, status, rental_type enums from schema
const PROPERTY_TYPES = ["Apartment", "House", "Commercial", "Office", "Studio"];
const STATUS_OPTIONS = ["Available", "Rented", "Maintenance"];
const RENTAL_TYPES = ["Daily", "Weekly", "Monthly", "Yearly"];

export default function CreateListingForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    address: "",
    property_type: PROPERTY_TYPES[0],
    city: "",
    state: "",
    zip_code: "",
    status: STATUS_OPTIONS[0],
    price: "",
    security_deposit: "",
    rental_type: RENTAL_TYPES[0],
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(form);
    setSubmitting(false);
  }

  return (
    <form
      className="space-y-6 bg-white rounded-2xl shadow-lg p-8 border border-slate-100"
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Title</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
            placeholder="e.g. Modern Office Space"
          />
        </div>
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Property Type</label>
          <select
            name="property_type"
            value={form.property_type}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-slate-700 font-semibold mb-1">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
          placeholder="Describe your property, amenities, etc."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Address</label>
          <input
            name="address"
            value={form.address}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
            placeholder="123 Main St"
          />
        </div>
        <div>
          <label className="block text-slate-700 font-semibold mb-1">City</label>
          <input
            name="city"
            value={form.city}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
            placeholder="City"
          />
        </div>
        <div>
          <label className="block text-slate-700 font-semibold mb-1">State</label>
          <input
            name="state"
            value={form.state}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
            placeholder="State"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Zip Code</label>
          <input
            name="zip_code"
            value={form.zip_code}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
            placeholder="Zip Code"
          />
        </div>
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Rental Type</label>
          <select
            name="rental_type"
            value={form.rental_type}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
          >
            {RENTAL_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Price</label>
          <input
            name="price"
            type="number"
            value={form.price}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
            placeholder="e.g. 1000"
          />
        </div>
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Security Deposit</label>
          <input
            name="security_deposit"
            type="number"
            value={form.security_deposit}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition shadow-sm bg-slate-50"
            placeholder="e.g. 500"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--brand)] px-6 py-2.5 text-base font-semibold text-white hover:bg-[var(--brand-dark)] shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={submitting}
        >
          {submitting ? "Creating..." : "Create Listing"}
        </button>
      </div>
    </form>
  );
}
