import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { assessmentApi, mlAssessmentApi } from "../lib/api";
import { AssessmentPage } from "./AssessmentPage";
import type { ObesityPredictionResult } from "../types";

const prediction: ObesityPredictionResult = {
  predicted_category: "Normal_Weight",
  category_label: "Normal Weight",
  model: "obesity_lifestyle_only",
  class_probabilities: { Normal_Weight: 0.8, Overweight_Level_I: 0.2 },
  disclaimer: "Educational demonstration only.",
  recommendations: ["Keep up regular activity."],
};

function renderPage() {
  vi.spyOn(assessmentApi, "history").mockResolvedValue([]);
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AssessmentPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ML lifestyle classifier", () => {
  it("submits the lifestyle-only feature set and renders the prediction", async () => {
    const user = userEvent.setup();
    const predict = vi.spyOn(mlAssessmentApi, "predictLifestyle").mockResolvedValue(prediction);
    renderPage();

    await user.click(screen.getByRole("tab", { name: "ML lifestyle classifier" }));
    await user.click(screen.getByRole("button", { name: "Run ML estimate" }));

    await waitFor(() => expect(predict).toHaveBeenCalledOnce());
    const payload = predict.mock.calls[0][0];
    expect(payload).toMatchObject({
      Gender: "Female",
      Age: 25,
      MTRANS: "Public_Transportation",
    });
    expect(payload).not.toHaveProperty("Height");
    expect(payload).not.toHaveProperty("Weight");
    expect(await screen.findByText("Normal weight", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("80.0%")).toBeInTheDocument();
    expect(screen.getByText("Educational demonstration only.")).toBeInTheDocument();
  });

  it("includes height and weight for the all-features model", async () => {
    const user = userEvent.setup();
    const predict = vi.spyOn(mlAssessmentApi, "predictAllFeatures").mockResolvedValue({
      ...prediction,
      model: "obesity_all_features",
    });
    renderPage();

    await user.click(screen.getByRole("tab", { name: "ML lifestyle classifier" }));
    await user.click(screen.getByRole("button", { name: /All features/ }));
    expect(screen.getByLabelText("Height (meters)")).toBeInTheDocument();
    expect(screen.getByLabelText("Weight (kg)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Run ML estimate" }));
    await waitFor(() => expect(predict).toHaveBeenCalledOnce());
    expect(predict.mock.calls[0][0]).toMatchObject({
      Gender: "Female",
      Height: 1.7,
      Weight: 70,
    });
  });

  it("validates numeric ranges before sending input", async () => {
    const user = userEvent.setup();
    const predict = vi.spyOn(mlAssessmentApi, "predictLifestyle").mockResolvedValue(prediction);
    renderPage();

    await user.click(screen.getByRole("tab", { name: "ML lifestyle classifier" }));
    fireEvent.change(screen.getByLabelText("Age (years)"), { target: { value: "5" } });
    await user.click(screen.getByRole("button", { name: "Run ML estimate" }));

    expect(predict).not.toHaveBeenCalled();
  });
});
