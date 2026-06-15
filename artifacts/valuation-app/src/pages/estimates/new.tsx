import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm, type UseFormReturn, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  AlertCircle,
  Anchor,
  Armchair,
  ArrowLeft,
  ArrowRight,
  Bike,
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Car,
  Coins,
  Cpu,
  Disc3,
  Dumbbell,
  Footprints,
  Gem,
  Guitar,
  Home,
  House,
  Laptop,
  Layers,
  type LucideIcon,
  Mailbox,
  MapPin,
  Palette,
  Paintbrush,
  Plane,
  ShoppingBag,
  Shirt,
  Smartphone,
  Sofa,
  Snowflake,
  Sparkles,
  SquareStack,
  Tablet,
  Tent,
  Trophy,
  Wallet,
  Watch,
  Wine,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useAuthStubContext } from "@/context/AuthStubContext";

import {
  ApiError,
  useListAssetTypes,
  useListRegions,
  useCreateEstimate,
  useListPortfolios,
  getListPortfoliosQueryKey,
  getListEstimatesQueryKey,
  getGetEstimateStatsQueryKey,
} from "@workspace/api-client-react";
import type { EstimateInput, AssetType, AssetField, Portfolio } from "@workspace/api-client-react";
import { assetTypeAllowedForSellerTier } from "@workspace/asset-shelf-tier";
import { GENERAL_ITEM_ASSET_TYPE_ID, isWizardSupportedAssetTypeId, pickAssetTypesForWizardPicker } from "@workspace/curated-asset-ids";
import { inferVehicleFuelHint, matchFuelDropdownOption } from "@workspace/marketplace-regions";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GlossaryHelp } from "@/components/estimate/GlossaryHelp";
import { getGlossaryForField, GLOSSARY } from "@/lib/estimate-glossary";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { localizeField } from "@/lib/regional";
import { tryUsePortfolioWorkspace } from "@/context/PortfolioWorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { PhotoUploadCard } from "@/components/PhotoUploadCard";
import { AssetCategoriesLoadHint } from "@/lib/asset-categories-fetch-hint";
import { PageTitle } from "@/components/layout/PageTitle";
import { ValuationProgressScreen } from "@/components/estimate/ValuationProgressScreen";
import { KnowledgeLevelStep } from "@/components/identification/KnowledgeLevelStep";
import {
  ValuationIdentificationStep,
  type IdentificationCompletePayload,
} from "@/components/identification/ValuationIdentificationStep";
import { supportsIdentificationFlow } from "@/lib/identification/profiles";
import {
  applyVerificationToForm,
  verificationToExtraFields,
  VERIFICATION_COVERED_FIELD_KEYS,
} from "@/lib/identification/apply-to-form";
import type { KnowledgeLevel } from "@/lib/identification/types";

const PENDING_KEY = "valyoued.pendingEstimate";
/** When a type has more driver fields than this, the wizard adds a second "details" step. */
const VALUE_DRIVER_STEP_CAP = 8;
/** Mirrors server `general-item` so the wizard can render if `/api/asset-types` is slow or unavailable. */
const GENERAL_ITEM_FALLBACK: AssetType = {
  id: GENERAL_ITEM_ASSET_TYPE_ID,
  name: "Anything Else",
  category: "Other",
  tagline: "Use this for any other item; describe it in detail",
  exampleAttributes:
    "Anything that helps a buyer understand what it is and why it has value",
  internationallyTradeable: true,
  fields: [
    { key: "brand", label: "Brand / maker (if any)", type: "text", required: false },
    {
      key: "model",
      label: "What is it?",
      type: "text",
      required: true,
      placeholder: "Vintage Polaroid SX-70 camera",
    },
    { key: "year", label: "Year", type: "number", required: false },
    {
      key: "purchasePrice",
      label: "Original purchase price",
      type: "number",
      required: false,
      help: "We will assume this is in your local currency.",
    },
    {
      key: "itemCategory",
      label: "What kind of thing is it?",
      type: "select",
      required: false,
      options: ["Tool or machine", "Toy or game", "Home appliance", "Tooling / workshop", "Art or decor", "Something else"],
    },
    {
      key: "keywordsForComps",
      label: "Search keywords a buyer would use",
      type: "text",
      required: false,
      placeholder: "DeWalt 18V hammer drill DCD996",
    },
  ],
};

type PendingPayload = { input: EstimateInput };

const baseSchema = z.object({
  assetTier: z.enum(["everyday", "luxury"]),
  assetTypeId: z.string().min(1, "Asset type is required"),
  title: z.string().min(1, "Title is required"),
  currentRegion: z.string().min(1, "Region is required"),
  condition: z.coerce.number().min(1).max(10),
  attributes: z.string().optional(),
});

// The form holds the schema fields above PLUS a dynamic set of asset-class
// specific fields (brand, model, year, purchasePrice, plus per-class extras).
// We type the form value as a permissive Record so dynamic FormField name
// strings don't blow up TypeScript while still keeping `assetTier` strict.
type FormValues = z.input<typeof baseSchema> & Record<string, string | number | undefined>;

const STANDARD_KEYS = new Set(["assetTypeId", "title", "currentRegion", "condition", "attributes", "brand", "model", "year", "purchasePrice"]);

function descriptorTitlePlaceholder(category: string | undefined): string {
  switch (category) {
    case "Real Estate":
      return "Example: 3-bed Victorian terrace, leafy street, York YO1";
    case "Vehicles":
      return "Example: 2019 BMW 330i M Sport, 42k miles, metallic grey";
    case "Watches & Jewelry":
      return "Example: Rolex Submariner Date 116610LN";
    default:
      return "Example: Brand, model, and details buyers would notice first";
  }
}

// Each top-level category gets a friendly icon for the picker grid.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Watches & Jewelry": Watch,
  "Bags & Fashion": ShoppingBag,
  "Vehicles": Car,
  "Real Estate": Home,
  "Electronics": Cpu,
  "Collectibles & Art": Paintbrush,
  "Home & Antiques": Sofa,
  "Sports & Outdoors": Bike,
  "Business": Briefcase,
  "Other": Sparkles,
};

function iconForCategory(cat: string): LucideIcon {
  return CATEGORY_ICONS[cat] ?? Sparkles;
}

/** Per concrete asset type inside a category sub-picker (fallback: category chip). */
const ASSET_TYPE_ICONS: Partial<Record<string, LucideIcon>> = {
  [GENERAL_ITEM_ASSET_TYPE_ID]: Sparkles,
  "luxury-watch": Watch,
  "fine-jewelry": Gem,
  "vintage-watch": Watch,
  "pocket-watch": Watch,
  "designer-handbag": ShoppingBag,
  "sneakers": Footprints,
  "streetwear-apparel": Shirt,
  "designer-accessories": Wallet,
  "car": Car,
  "classic-car": Car,
  "everyday-car": Car,
  "motorcycle": Bike,
  "boat-marine": Anchor,
  "rv-camper": Tent,
  "smartphone": Smartphone,
  "laptop": Laptop,
  "camera": Camera,
  "tablet": Tablet,
  "drone-uav": Plane,
  "residential-property": Home,
  "commercial-property": Building2,
  "land-plot": MapPin,
  "fine-art": Palette,
  "trading-cards": Layers,
  "wine-spirits": Wine,
  "vinyl-records": Disc3,
  "rare-books": BookMarked,
  "musical-instrument": Guitar,
  "designer-furniture": Sofa,
  "antique": Armchair,
  "premium-rug": SquareStack,
  "sports-memorabilia": Trophy,
  "comic-books": BookOpen,
  "numismatics": Coins,
  "philately": Mailbox,
  "bicycle": Bike,
  "golf-equipment": Trophy,
  "winter-sports": Snowflake,
  "camping-outdoor": Tent,
  "fitness-equipment": Dumbbell,
  "saas-micro": Cpu,
};

function iconForAssetType(typeId: string, category: string): LucideIcon {
  return ASSET_TYPE_ICONS[typeId] ?? iconForCategory(category);
}

const SAAS_MICRO_ID = "saas-micro";

type WizardStepId =
  | "tier"
  | "pickType"
  | "knowledgeLevel"
  | "itemVerification"
  | "title"
  | "region"
  | "identity"
  | "valueDrivers"
  | "valueDrivers2"
  | "condition"
  | "purchasePrice"
  | "additional";

function classifyAssetFields(type: AssetType | undefined): {
  identity: AssetField[];
  drivers: AssetField[];
} {
  if (!type) return { identity: [], drivers: [] };
  const identityKeys = new Set(["brand", "model", "year"]);
  const withoutPrice = type.fields.filter((f) => f.key !== "purchasePrice");
  const identity = withoutPrice.filter((f) => identityKeys.has(f.key));
  const drivers = withoutPrice.filter((f) => !identityKeys.has(f.key) && f.key !== "condition");
  return { identity, drivers };
}

function stepTitle(id: WizardStepId): string {
  switch (id) {
    case "tier":
      return "What kind of item is it?";
    case "pickType":
      return "What are you valuing?";
    case "knowledgeLevel":
      return "Do you know exactly what item you have?";
    case "itemVerification":
      return "Verify your item";
    case "title":
      return "Short listing headline";
    case "region":
      return "Where are you selling?";
    case "identity":
      return "Basics: brand, model, year";
    case "valueDrivers":
      return "Details buyers care about";
    case "valueDrivers2":
      return "More details";
    case "condition":
      return "Overall condition";
    case "purchasePrice":
      return "Price context (optional)";
    case "additional":
      return "Anything else?";
    default:
      return "";
  }
}

type EstimateForm = UseFormReturn<FormValues>;

function DynamicAssetFieldRow({
  form,
  rawF,
  selectedRegion,
  selectedRegionName,
  assetTypeId,
}: {
  form: EstimateForm;
  rawF: AssetField;
  selectedRegion: { currencySymbol: string; currencyCode: string } | undefined;
  selectedRegionName: string;
  assetTypeId: string;
}) {
  const f = localizeField(rawF, selectedRegionName);
  const gloss = getGlossaryForField(f.key, assetTypeId, selectedRegionName);
  const brandWatch = String(useWatch({ control: form.control, name: "brand" as any }) ?? "").trim();
  const modelWatch = String(useWatch({ control: form.control, name: "model" as any }) ?? "").trim();
  const fuelHint =
    f.key === "fuelType" &&
    (assetTypeId === "car" || assetTypeId === "everyday-car" || assetTypeId === "classic-car")
      ? inferVehicleFuelHint({ brand: brandWatch, model: modelWatch })
      : null;
  const inferredFuelOption = useMemo(() => {
    if (!fuelHint || !f.options?.length) return undefined;
    return matchFuelDropdownOption(fuelHint.canonical, f.options);
  }, [fuelHint, f.options]);

  const isPrice = f.key === "purchasePrice";

  const labelSuffix = isPrice && selectedRegion ? ` (${selectedRegion.currencyCode})` : "";

  return (
    <FormField
      key={f.key}
      control={form.control}
      name={f.key as keyof FormValues}
      render={({ field: formField }) => (
        <FormItem className={f.type === "textarea" ? "md:col-span-2" : ""}>
          <div className="flex items-center gap-1">
            <FormLabel>
              {f.label}
              {labelSuffix}
              {f.required ? " *" : ""}
            </FormLabel>
            {gloss ? <GlossaryHelp entry={gloss} label={f.label} /> : null}
          </div>
          <FormControl>
            {f.type === "textarea" ? (
              <Textarea
                placeholder={f.placeholder}
                className="resize-y min-h-[100px] bg-background"
                {...formField}
                value={formField.value ?? ""}
              />
            ) : f.type === "select" ? (
              <Select onValueChange={formField.onChange} value={(formField.value ?? "") as string}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder={f.placeholder || "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {f.options?.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : isPrice && selectedRegion ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground tabular-nums">
                  {selectedRegion.currencySymbol}
                </span>
                <Input
                  type="number"
                  placeholder={f.placeholder}
                  className="h-10 bg-background pl-10"
                  {...formField}
                  value={formField.value ?? ""}
                />
              </div>
            ) : (
              <Input
                type={f.type === "number" ? "number" : "text"}
                placeholder={f.placeholder}
                className="h-10 bg-background"
                {...formField}
                value={formField.value ?? ""}
              />
            )}
          </FormControl>
          {fuelHint &&
          inferredFuelOption &&
          f.key === "fuelType" &&
          !String(formField.value ?? "").trim() ? (
            <div className="space-y-1.5 rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-2">
              <FormDescription className="text-xs leading-relaxed">
                Suggested from model (please confirm): {fuelHint.reason}
              </FormDescription>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => formField.onChange(inferredFuelOption)}
              >
                Use {inferredFuelOption}
              </Button>
            </div>
          ) : null}
          {f.help ? <FormDescription>{f.help}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Human hint for the wizard portfolio dropdown (shown next to the workspace name). */
function portfolioWorkspaceHelpText(purpose: Portfolio["purpose"]): string {
  if (purpose === "primary") return "Your main holdings";
  if (purpose === "inheritance") return "Estate, heirlooms, or items you track for others";
  if (purpose === "pro_board") return "Professional desk";
  return "Workspace";
}

function describeValuationGateError(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    const payload = err.data as { error?: string } | null | undefined;
    return (
      payload?.error ??
      "You've used all five free valuations this month. Upgrade via Settings for unlimited valuations."
    );
  }
  return "";
}

function NewEstimatePageInner({
  authLoaded,
  isSignedIn,
}: {
  authLoaded: boolean;
  isSignedIn: boolean;
}) {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const authStubMode = useAuthStubContext();
  const portfolioCtx = tryUsePortfolioWorkspace();
  const [portfolioChoice, setPortfolioChoice] = useState<string | undefined>(undefined);

  const {
    data: assetTypes,
    isFetching: assetTypesFetching,
    isError: assetTypesError,
    error: assetTypesErr,
    refetch: refetchAssetTypes,
  } = useListAssetTypes();
  const { data: regions } = useListRegions();
  const createMutation = useCreateEstimate();

  const { data: portfoliosList } = useListPortfolios({
    query: {
      enabled: isSignedIn || authStubMode,
      queryKey: getListPortfoliosQueryKey(),
    },
  });

  useEffect(() => {
    const def = portfolioCtx?.activePortfolio?.id ?? portfolioCtx?.primaryPortfolio?.id;
    if (!def) return;
    setPortfolioChoice((prev) => prev ?? def);
  }, [portfolioCtx?.activePortfolio?.id, portfolioCtx?.primaryPortfolio?.id]);

  // Auto-resume: if the user filled the form anonymously, signed up, and was
  // redirected back here; submit their pending payload immediately.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!authLoaded || !isSignedIn || resumedRef.current) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let pending: PendingPayload | null = null;
    try {
      pending = JSON.parse(raw) as PendingPayload;
    } catch {
      sessionStorage.removeItem(PENDING_KEY);
      return;
    }
    if (!pending || !pending.input?.assetTypeId || !isWizardSupportedAssetTypeId(pending.input.assetTypeId)) {
      sessionStorage.removeItem(PENDING_KEY);
      if (pending?.input?.assetTypeId && !isWizardSupportedAssetTypeId(pending.input.assetTypeId)) {
        toast({
          title: "Could not resume",
          description: "That valuation used a retired category. Please start again and pick a supported type, or Anything Else.",
          variant: "destructive",
        });
      }
      return;
    }
    resumedRef.current = true;
    sessionStorage.removeItem(PENDING_KEY);
    const resumePayload = { ...pending.input } satisfies PendingPayload["input"];
    const pfResolved =
      portfolioCtx?.activePortfolio?.id ?? portfolioCtx?.primaryPortfolio?.id ?? portfoliosList?.[0]?.id;
    if (pfResolved && resumePayload.portfolioId === undefined) {
      resumePayload.portfolioId = pfResolved;
    }
    createMutation.mutate(
      { data: resumePayload },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListEstimatesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetEstimateStatsQueryKey() });
          setLocation(`/estimates/${result.id}/welcome`);
        },
        onError: (err: unknown) => {
          const capped = describeValuationGateError(err);
          toast({
            title: capped ? "Monthly free limit reached" : "Couldn't finish your valuation",
            description:
              capped ||
              (err instanceof Error ? err.message : "") ||
              "Something went wrong while finishing the valuation you started. Please try again from the form below.",
            variant: "destructive",
          });
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, isSignedIn]);

  const form = useForm<FormValues>({
    resolver: async (data) => {
      const baseResult = baseSchema.safeParse(data);
      if (!baseResult.success) {
        return { values: {}, errors: baseResult.error.formErrors.fieldErrors as any };
      }
      if (!isWizardSupportedAssetTypeId(data.assetTypeId)) {
        return {
          values: {},
          errors: {
            assetTypeId: {
              type: "validate",
              message: "Choose a supported item type, or Anything Else.",
            },
          },
        };
      }
      const type = assetTypes?.find((t) => t.id === data.assetTypeId);
      if (!type) return { values: data, errors: {} };
      const errors: Record<string, any> = {};
      for (const field of type.fields) {
        if (field.required && (data[field.key] === undefined || data[field.key] === "")) {
          errors[field.key] = { type: "required", message: `${field.label} is required` };
        }
      }
      if (Object.keys(errors).length > 0) return { values: {}, errors };
      return { values: data, errors: {} };
    },
    defaultValues: {
      assetTier: undefined as unknown as "everyday" | "luxury",
      assetTypeId: "",
      title: "",
      currentRegion: "",
      condition: 7,
      attributes: "",
    },
    mode: "onChange",
  });

  const selectedTier = form.watch("assetTier");
  const selectedTypeId = form.watch("assetTypeId");
  const selectedType = useMemo((): AssetType | undefined => {
    if (!selectedTypeId) return undefined;
    if (!isWizardSupportedAssetTypeId(selectedTypeId)) return undefined;
    if (selectedTypeId === GENERAL_ITEM_ASSET_TYPE_ID) {
      return assetTypes?.find((t) => t.id === GENERAL_ITEM_ASSET_TYPE_ID) ?? GENERAL_ITEM_FALLBACK;
    }
    return assetTypes?.find((t) => t.id === selectedTypeId);
  }, [assetTypes, selectedTypeId]);

  const selectedRegionName = form.watch("currentRegion");
  const selectedRegion = useMemo(
    () => regions?.find((r) => r.name === selectedRegionName),
    [regions, selectedRegionName],
  );

  useEffect(() => {
    if (!selectedRegion?.currencyCode) return;
    const sale = form.getValues("saleCurrency");
    if (!sale) form.setValue("saleCurrency", selectedRegion.currencyCode);
    const purchase = form.getValues("purchaseCurrency");
    if (!purchase) form.setValue("purchaseCurrency", selectedRegion.currencyCode);
  }, [selectedRegion?.currencyCode, form]);

  const tierFilteredAssetTypes = useMemo((): AssetType[] => {
    if (!assetTypes?.length || !selectedTier) return [];
    return assetTypes.filter((t) => assetTypeAllowedForSellerTier(t.id, selectedTier));
  }, [assetTypes, selectedTier]);

  const wizardPickableAssetTypes = useMemo(
    () => pickAssetTypesForWizardPicker(tierFilteredAssetTypes),
    [tierFilteredAssetTypes],
  );

  const grouped = useMemo(() => {
    if (!wizardPickableAssetTypes.length) return [];
    const map = new Map<string, AssetType[]>();
    for (const t of wizardPickableAssetTypes) {
      const key = t.category || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [wizardPickableAssetTypes]);

  const assetTypesLoading = assetTypes === undefined && assetTypesFetching;
  const assetTypesErrMessage =
    assetTypesErr instanceof Error ? assetTypesErr.message : String(assetTypesErr ?? "Unknown error");

  // Two-step asset picker: pick a top-level category first, then pick the
  // specific asset class. Avoids the long, clipped dropdown.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCategory(null);
  }, [selectedTier]);

  useEffect(() => {
    if (!selectedTypeId || !assetTypes?.length) return;
    if (isWizardSupportedAssetTypeId(selectedTypeId)) return;
    const prev = assetTypes.find((t) => t.id === selectedTypeId);
    if (prev) {
      prev.fields.forEach((f) => {
        if (!STANDARD_KEYS.has(f.key)) form.setValue(f.key as any, undefined);
      });
    }
    form.setValue("assetTypeId", "");
    setSelectedCategory(null);
  }, [selectedTypeId, assetTypes, form]);

  useEffect(() => {
    if (!selectedTier || !selectedTypeId || !assetTypes?.length) return;
    if (!isWizardSupportedAssetTypeId(selectedTypeId)) return;
    if (assetTypeAllowedForSellerTier(selectedTypeId, selectedTier)) return;
    const prev = assetTypes.find((t) => t.id === selectedTypeId);
    if (prev) {
      prev.fields.forEach((f) => {
        if (!STANDARD_KEYS.has(f.key)) form.setValue(f.key as any, undefined);
      });
    }
    form.setValue("assetTypeId", "");
    setSelectedCategory(null);
  }, [selectedTier, selectedTypeId, assetTypes, form]);

  // Auto-sync the category panel when an asset type is selected (such as via
  // pending payload resume) so the picker shows the right step.
  useEffect(() => {
    if (selectedType && selectedType.category && selectedType.category !== selectedCategory) {
      setSelectedCategory(selectedType.category);
    }
  }, [selectedType, selectedCategory]);

  const [knowledgeLevel, setKnowledgeLevel] = useState<KnowledgeLevel | null>(null);
  const [identificationComplete, setIdentificationComplete] = useState(false);
  const [verificationPayload, setVerificationPayload] = useState<IdentificationCompletePayload | null>(null);

  useEffect(() => {
    setKnowledgeLevel(null);
    setIdentificationComplete(false);
    setVerificationPayload(null);
  }, [selectedTypeId]);

  const { identityFields, driverFieldsPage1, driverFieldsPage2, wizardSteps } = useMemo(() => {
    const c = classifyAssetFields(selectedType);
    const drivers = identificationComplete
      ? c.drivers.filter((f) => !VERIFICATION_COVERED_FIELD_KEYS.has(f.key))
      : c.drivers;
    const steps: WizardStepId[] = ["tier", "pickType"];
    if (selectedType && supportsIdentificationFlow(selectedType.id)) {
      steps.push("knowledgeLevel", "itemVerification");
    }
    steps.push("title", "region");
    if (c.identity.length) steps.push("identity");
    if (drivers.length) {
      steps.push("valueDrivers");
      if (drivers.length > VALUE_DRIVER_STEP_CAP) steps.push("valueDrivers2");
    }
    steps.push("condition", "purchasePrice", "additional");
    return {
      identityFields: c.identity,
      driverFieldsPage1: drivers.slice(0, VALUE_DRIVER_STEP_CAP),
      driverFieldsPage2: drivers.slice(VALUE_DRIVER_STEP_CAP),
      wizardSteps: steps,
    };
  }, [selectedType, identificationComplete]);

  const [wizardStep, setWizardStep] = useState(0);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setWizardStep(0);
  }, [selectedTier]);

  const deepLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (!assetTypes?.length || deepLinkAppliedRef.current) return;
    const params = new URLSearchParams(searchString.startsWith("?") ? searchString.slice(1) : searchString);
    const tierParam = params.get("tier");
    const assetTypeParam = params.get("assetType");
    if (tierParam !== "everyday" && tierParam !== "luxury" && !assetTypeParam) return;

    deepLinkAppliedRef.current = true;
    if (tierParam === "everyday" || tierParam === "luxury") {
      form.setValue("assetTier", tierParam);
    }
    if (assetTypeParam && isWizardSupportedAssetTypeId(assetTypeParam)) {
      let tierForType: "everyday" | "luxury" | undefined =
        tierParam === "everyday" || tierParam === "luxury" ? tierParam : undefined;
      if (!tierForType) {
        const luxuryOk = assetTypeAllowedForSellerTier(assetTypeParam, "luxury");
        const everydayOk = assetTypeAllowedForSellerTier(assetTypeParam, "everyday");
        if (luxuryOk && !everydayOk) tierForType = "luxury";
        else if (everydayOk && !luxuryOk) tierForType = "everyday";
      }
      if (tierForType) form.setValue("assetTier", tierForType);
      form.setValue("assetTypeId", assetTypeParam);
      const match = assetTypes.find((t) => t.id === assetTypeParam);
      if (match?.category) setSelectedCategory(match.category);
      setWizardStep(2);
    } else if (tierParam) {
      setWizardStep(1);
    }
  }, [assetTypes, form, searchString]);

  useEffect(() => {
    setWizardStep((i) => Math.min(i, Math.max(0, wizardSteps.length - 1)));
  }, [wizardSteps.length]);

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [wizardStep]);

  const currentStepId: WizardStepId = wizardSteps[wizardStep] ?? "tier";
  const progressPct =
    wizardSteps.length > 1 ? Math.round((wizardStep / (wizardSteps.length - 1)) * 100) : 100;

  const purchaseFieldDef = useMemo(
    () => selectedType?.fields.find((f) => f.key === "purchasePrice"),
    [selectedType],
  );

  const handlePhotoAutoFill = useCallback(
    (extracted: Record<string, string>, suggestedTitle?: string) => {
      if (!selectedType) return;
      if (suggestedTitle && !String(form.getValues("title") ?? "").trim()) {
        form.setValue("title", suggestedTitle, { shouldValidate: true });
      }
      for (const [key, value] of Object.entries(extracted)) {
        const fd = selectedType.fields.find((f) => f.key === key);
        if (!fd) continue;
        if (fd.type === "number") {
          const n = Number(value);
          if (!Number.isNaN(n)) {
            form.setValue(key as keyof FormValues, n, { shouldValidate: true });
          }
        } else {
          form.setValue(key as keyof FormValues, value, { shouldValidate: true });
        }
      }
    },
    [form, selectedType],
  );

  function validateWizardStep(stepId: WizardStepId): boolean {
    const v = form.getValues();
    switch (stepId) {
      case "tier":
        if (!v.assetTier) {
          toast({
            title: "Pick a track",
            description: "Choose everyday or luxury so we match the right shelf.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case "pickType":
        if (!v.assetTypeId) {
          toast({
            title: "Pick an item type",
            description: "Select what you are valuing to continue.",
            variant: "destructive",
          });
          return false;
        }
        if (!isWizardSupportedAssetTypeId(v.assetTypeId)) {
          toast({
            title: "Pick a supported item type",
            description: "Pick a guided template, or choose Anything Else.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case "knowledgeLevel":
        if (!knowledgeLevel) {
          toast({
            title: "Pick an option",
            description: "Tell us how well you know your item so we can tailor verification.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case "itemVerification":
        if (!identificationComplete) {
          toast({
            title: "Complete verification",
            description: "Finish verifying your item before we generate a valuation.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case "title":
        if (!String(v.title ?? "").trim()) {
          toast({
            title: "Add a short title",
            description: "A headline helps the report and listings.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case "region":
        if (!v.currentRegion) {
          toast({
            title: "Pick a region",
            description: "We need your region for currency and local comps.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      case "identity":
        for (const f of identityFields) {
          if (f.required && (v[f.key] === undefined || v[f.key] === "")) {
            toast({
              title: "Missing detail",
              description: `${f.label} is required.`,
              variant: "destructive",
            });
            return false;
          }
        }
        return true;
      case "valueDrivers":
        for (const f of driverFieldsPage1) {
          if (f.required && (v[f.key] === undefined || v[f.key] === "")) {
            toast({
              title: "Missing detail",
              description: `${f.label} is required.`,
              variant: "destructive",
            });
            return false;
          }
        }
        return true;
      case "valueDrivers2":
        for (const f of driverFieldsPage2) {
          if (f.required && (v[f.key] === undefined || v[f.key] === "")) {
            toast({
              title: "Missing detail",
              description: `${f.label} is required.`,
              variant: "destructive",
            });
            return false;
          }
        }
        return true;
      case "condition": {
        const c0 = Number(v.condition);
        if (!Number.isFinite(c0) || c0 < 1 || c0 > 10) {
          toast({
            title: "Set condition",
            description: "Move the slider to set overall condition.",
            variant: "destructive",
          });
          return false;
        }
        return true;
      }
      case "purchasePrice":
      case "additional":
        return true;
      default:
        return true;
    }
  }

  function goNext() {
    const sid = wizardSteps[wizardStep];
    if (sid === undefined) return;
    if (!validateWizardStep(sid)) return;
    if (wizardStep < wizardSteps.length - 1) setWizardStep((s) => s + 1);
  }

  function goBack() {
    if (wizardStep > 0) setWizardStep((s) => s - 1);
  }

  const onSubmit = (data: any) => {
    if (!isWizardSupportedAssetTypeId(data.assetTypeId)) {
      toast({
        title: "Unsupported item type",
        description: "Pick a guided template, or choose Anything Else.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedType) {
      toast({ title: "Pick an asset class first", description: "Choose what you're valuing from the dropdown.", variant: "destructive" });
      return;
    }
    if (!selectedRegion) {
      toast({ title: "Pick a region", description: "We need to know where you're selling so we can value in your local currency.", variant: "destructive" });
      return;
    }

    const payload: EstimateInput = {
      assetTypeId: data.assetTypeId,
      title: data.title,
      currentRegion: data.currentRegion,
      currency: selectedRegion.currencyCode,
      condition: typeof data.condition === "number" ? data.condition : Number(data.condition) || 7,
    };
    // Prepend the tier hint into attributes so the model sees it. We don't
    // want to add a brand-new schema field server-side just for this; the
    // free-form notes already feed straight into the prompt.
    const tierLabel = data.assetTier === "luxury" ? "Luxury / Collectible" : "Everyday item";
    const tierLine = `Tier: ${tierLabel}.`;
    payload.attributes = data.attributes ? `${tierLine} ${data.attributes}` : tierLine;

    if (data.brand) payload.brand = data.brand;
    if (data.model) payload.model = data.model;
    if (data.year !== undefined && data.year !== "" && !Number.isNaN(Number(data.year))) payload.year = Number(data.year);
    if (data.purchasePrice !== undefined && data.purchasePrice !== "" && !Number.isNaN(Number(data.purchasePrice))) payload.purchasePrice = Number(data.purchasePrice);

    const extras: Record<string, string> = {};
    for (const f of selectedType.fields) {
      if (STANDARD_KEYS.has(f.key) || f.key === "condition") continue;
      const v = data[f.key];
      if (v !== undefined && v !== "" && v !== null) extras[f.key] = String(v);
    }
    if (data.purchaseCurrency) extras.purchaseCurrency = String(data.purchaseCurrency);
    if (data.saleCurrency) extras.saleCurrency = String(data.saleCurrency);
    if (verificationPayload) {
      Object.assign(extras, verificationToExtraFields(verificationPayload.answers, verificationPayload.confidence));
    }
    if (Object.keys(extras).length > 0) payload.extraFields = extras;

    const pfResolved = portfolioChoice ?? portfolioCtx?.primaryPortfolio?.id ?? portfoliosList?.[0]?.id;
    if (pfResolved) payload.portfolioId = pfResolved;

    // Onboarding gate: anonymous users must create an account before their
    // valuation is generated. We treat "auth not loaded yet" the same as
    // "signed out"; better to stash + bounce through sign-up than to fire an
    // API call that 401s and loses the form payload.
    if (!isSignedIn) {
      try {
        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ input: payload } satisfies PendingPayload),
        );
      } catch {
        /* sessionStorage may be unavailable; fall through and let the API 401 */
      }
      setLocation("/sign-up?redirect_url=/start");
      return;
    }

    createMutation.mutate(
      { data: payload },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListEstimatesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetEstimateStatsQueryKey() });
          setLocation(`/estimates/${result.id}/welcome`);
        },
        onError: (err: unknown) => {
          const capped = describeValuationGateError(err);
          const raw =
            err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err ?? "");
          let friendly = capped || "We couldn't generate the report. Please try again.";
          if (!capped && /timeout|timed out|ETIMEDOUT|aborted/i.test(raw)) {
            friendly =
              "The valuation took too long to come back. Our service may be busy; please retry in a moment.";
          } else if (!capped && /currency|condition|required/i.test(raw)) {
            friendly =
              "Some required details are missing. Make sure you've picked an asset class, a region, and filled in the condition slider before submitting.";
          } else if (!capped && /network|fetch|Failed to fetch/i.test(raw)) {
            friendly = "Couldn't reach the valuation server. Check your connection and try again.";
          }
          toast({
            title: capped ? "Free monthly cap" : "Valuation failed",
            description: friendly,
            variant: "destructive",
          });
          if (!capped) console.error("[valuation] create failed:", raw);
        },
      },
    );
  };

  const onInvalidSubmit = (errors: Record<string, any>) => {
    const firstKey = Object.keys(errors)[0];
    const firstMsg = firstKey ? errors[firstKey]?.message : "Please fill in the required fields before submitting.";
    toast({
      title: "Some fields need attention",
      description: firstMsg || "Please fill in the required fields before submitting.",
      variant: "destructive",
    });
  };

  if (createMutation.isPending) {
    return (
      <ValuationProgressScreen
        itemTitle={String(form.getValues("title") ?? "").trim() || undefined}
        assetTypeName={selectedType?.name}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div>
        <PageTitle>Start a valuation</PageTitle>
        {authLoaded && !authStubMode && !isSignedIn ? (
          <p className="text-muted-foreground mt-2 max-w-xl leading-relaxed">
            Next we ask for a quick free login so your report saves to your account.
          </p>
        ) : null}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-6">
          <Card className="border-border/50 bg-card/50 shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Step {wizardStep + 1} of {wizardSteps.length}
                  </span>
                  <span className="tabular-nums">{progressPct}%</span>
                </div>
                <Progress value={progressPct} aria-valuenow={progressPct} />
              </div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-lg font-sans font-semibold tracking-tight text-foreground outline-none"
              >
                {stepTitle(currentStepId)}
              </h2>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedType &&
                currentStepId !== "tier" &&
                currentStepId !== "pickType" &&
                currentStepId !== "knowledgeLevel" &&
                currentStepId !== "itemVerification" && (
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    After you choose the item template, drag or upload a photo on any step. We auto-fill whatever the
                    image supports (brand, specs, condition hints, and similar). You will still enter owner-only facts
                    such as mileage, purchase year, receipts, or tenancy when the form asks for them.
                  </p>
                  <PhotoUploadCard
                    assetTypeId={selectedType.id}
                    assetTypeName={selectedType.name}
                    assetCategory={selectedType.category}
                    onAutoFill={handlePhotoAutoFill}
                  />
                </div>
              )}

              {currentStepId === "tier" && (
                <FormField
                  control={form.control}
                  name="assetTier"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                        {[
                          {
                            value: "everyday" as const,
                            label: "Everyday asset",
                            desc: "Cars, electronics, furniture, and ordinary household items. Matches typical mass-market resale comps.",
                            Icon: House,
                          },
                          {
                            value: "luxury" as const,
                            label: "Luxury / Collectible",
                            desc: "Vintage watches, rare wines, classic cars, designer bags, trading cards, art, and other specialty collectible markets.",
                            Icon: Gem,
                          },
                        ].map((opt) => {
                          const active = field.value === opt.value;
                          const TierIcon = opt.Icon;
                          return (
                            <button
                              type="button"
                              key={opt.value}
                              onClick={() => {
                                field.onChange(opt.value);
                                requestAnimationFrame(() => {
                                  if (validateWizardStep("tier")) {
                                    setWizardStep((s) => Math.min(s + 1, wizardSteps.length - 1));
                                  }
                                });
                              }}
                              data-testid={`tier-${opt.value}`}
                              className={`rounded-lg border p-4 text-left transition-all ${
                                active
                                  ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                                  : "border-border bg-background hover:border-accent/50"
                              }`}
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <TierIcon className="h-5 w-5 shrink-0 text-accent" />
                                <span className="font-medium">{opt.label}</span>
                              </div>
                              <p className="text-xs leading-relaxed text-muted-foreground">{opt.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {currentStepId === "pickType" && selectedTier && (
                <FormField
                  control={form.control}
                  name="assetTypeId"
                  render={({ field }) => {
                    const currentList = selectedCategory
                      ? grouped.find(([c]) => c === selectedCategory)?.[1] ?? []
                      : [];
                    return (
                      <FormItem>
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {selectedCategory
                            ? `Pick the specific item type in ${selectedCategory}`
                            : "Pick a category"}
                        </p>
                        {!selectedCategory ? (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Guided item templates cover electronics, watches, cameras, jewelry, fine art, cars, handbags, and
                            sneakers. Everyday vs Luxury only hides picks that clash with that framing. Anything Else is
                            for everything outside those templates.
                          </p>
                        ) : null}

                        {!selectedCategory && (
                          <>
                            {assetTypesLoading && (
                              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3" aria-busy="true">
                                {Array.from({ length: 9 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="h-[4.25rem] animate-pulse rounded-lg border border-border/30 bg-muted/55"
                                  />
                                ))}
                              </div>
                            )}
                            {assetTypesError && (
                              <Alert variant="destructive" className="mt-1">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Could not load asset categories</AlertTitle>
                                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-balance">
                                    {assetTypesErrMessage}
                                    <AssetCategoriesLoadHint error={assetTypesErr} />
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 border-destructive/40"
                                    onClick={() => void refetchAssetTypes()}
                                  >
                                    Retry
                                  </Button>
                                </AlertDescription>
                              </Alert>
                            )}
                            {!assetTypesLoading && !assetTypesError && grouped.length === 0 && (
                              <p className="pt-2 text-sm text-muted-foreground">
                                The server returned no asset categories. Try again shortly or describe a custom item below.
                              </p>
                            )}
                            {!assetTypesLoading && !assetTypesError && grouped.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
                                {grouped.map(([cat, list]) => {
                                  const Icon = iconForCategory(cat);
                                  return (
                                    <button
                                      type="button"
                                      key={cat}
                                      onClick={() => setSelectedCategory(cat)}
                                      data-testid={`category-${cat.replace(/\s+/g, "-").toLowerCase()}`}
                                      className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-left transition-all hover:border-accent hover:bg-accent/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    >
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                                        <Icon className="h-5 w-5" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{cat}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {list.length} {list.length === 1 ? "type" : "types"}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {(!!assetTypes || assetTypesError) && (
                              <div className="mt-4 border-t border-border/60 pt-3">
                                <button
                                  type="button"
                                  data-testid="custom-asset-type"
                                  className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                                  onClick={() => {
                                    if (selectedType) {
                                      selectedType.fields.forEach((f) => form.setValue(f.key as any, undefined));
                                    }
                                    setSelectedCategory("Other");
                                    field.onChange(GENERAL_ITEM_ASSET_TYPE_ID);
                                  }}
                                >
                                  Item not listed? Use a custom description instead
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {selectedCategory && (
                          <div className="space-y-3 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedType) {
                                  selectedType.fields.forEach((f) => form.setValue(f.key as any, undefined));
                                }
                                field.onChange("");
                                setSelectedCategory(null);
                              }}
                              data-testid="back-to-categories"
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              Back to categories
                            </button>
                            {currentList.length > 0 ? (
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {currentList.map((type) => {
                                  const active = field.value === type.id;
                                  const Icon = iconForAssetType(type.id, type.category);
                                  return (
                                    <button
                                      type="button"
                                      key={type.id}
                                      onClick={() => {
                                        if (selectedType && selectedType.id !== type.id) {
                                          selectedType.fields.forEach((f) => form.setValue(f.key as any, undefined));
                                        }
                                        field.onChange(type.id);
                                      }}
                                      data-testid={`asset-type-${type.id}`}
                                      className={`rounded-lg border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                        active
                                          ? "border-accent bg-accent/10 ring-1 ring-accent"
                                          : "border-border bg-background hover:border-accent/50 hover:bg-accent/5"
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                                          <Icon className="h-5 w-5" aria-hidden />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-medium">{type.name}</div>
                                          {type.tagline && (
                                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                              {type.tagline}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : field.value === GENERAL_ITEM_ASSET_TYPE_ID ? (
                              <div className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Anything Else</span> is selected. Continue to add
                                details in the next steps.
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No types in this category matched the server response. Go back or use a custom description.
                              </p>
                            )}
                          </div>
                        )}

                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              )}

              {currentStepId === "knowledgeLevel" && selectedType && (
                <KnowledgeLevelStep
                  value={knowledgeLevel ?? undefined}
                  onChange={(level) => {
                    setKnowledgeLevel(level);
                    setIdentificationComplete(false);
                    setVerificationPayload(null);
                  }}
                />
              )}

              {currentStepId === "itemVerification" && selectedType && knowledgeLevel && (
                <ValuationIdentificationStep
                  assetTypeId={selectedType.id}
                  knowledgeLevel={knowledgeLevel}
                  onComplete={(payload) => {
                    setVerificationPayload(payload);
                    setIdentificationComplete(true);
                    applyVerificationToForm(form, payload.answers, payload.confidence);
                    requestAnimationFrame(() => {
                      setWizardStep((s) => Math.min(s + 1, wizardSteps.length - 1));
                    });
                  }}
                />
              )}

              {currentStepId === "title" && selectedType && (
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Listing headline</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={descriptorTitlePlaceholder(selectedType.category)}
                          className="h-10 bg-background"
                          {...field}
                        />
                      </FormControl>
                      {selectedType.tagline ? (
                        <FormDescription className="italic">{selectedType.tagline}</FormDescription>
                      ) : null}
                      {!selectedType.internationallyTradeable ? (
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                          Local-market asset · international arbitrage disabled
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {currentStepId === "region" && (
                <div className="grid gap-6">
                  <FormField
                    control={form.control}
                    name="currentRegion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Where are you selling?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10 bg-background">
                              <SelectValue placeholder="Country or market you will list in" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {regions?.map((r) => (
                              <SelectItem key={r.name} value={r.name}>
                                {r.name}{" "}
                                <span className="tabular-nums text-sm text-muted-foreground">({r.currencyCode})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Pick the country or market where you plan to sell. We use this for local comps and listing
                          currency{selectedRegion ? ` (${selectedRegion.currencyCode})` : ""}.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {selectedType?.internationallyTradeable && regions && regions.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="purchaseCurrency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purchase currency</FormLabel>
                            <Select onValueChange={field.onChange} value={String(field.value ?? "")}>
                              <FormControl>
                                <SelectTrigger className="h-10 bg-background">
                                  <SelectValue placeholder="Currency you paid in" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {regions.map((r) => (
                                  <SelectItem key={`purchase-${r.currencyCode}`} value={r.currencyCode}>
                                    {r.currencyCode} · {r.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>Optional. What currency did you pay when you bought it?</FormDescription>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="saleCurrency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sale currency</FormLabel>
                            <Select onValueChange={field.onChange} value={String(field.value ?? "")}>
                              <FormControl>
                                <SelectTrigger className="h-10 bg-background">
                                  <SelectValue placeholder="Currency you expect to receive" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {regions.map((r) => (
                                  <SelectItem key={`sale-${r.currencyCode}`} value={r.currencyCode}>
                                    {r.currencyCode} · {r.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Optional. For cross-border sales, pick where you expect to be paid.
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : null}
                  {portfoliosList && portfoliosList.length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="estimate-portfolio-workspace">Portfolio workspace</Label>
                      <Select value={portfolioChoice ?? ""} onValueChange={(v) => setPortfolioChoice(v)}>
                        <SelectTrigger id="estimate-portfolio-workspace" className="h-10 bg-background">
                          <SelectValue placeholder="Select workspace" />
                        </SelectTrigger>
                        <SelectContent>
                          {portfoliosList.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="font-medium">{p.label?.trim() ? p.label : p.id.slice(0, 8)}</span>
                              <span className="text-muted-foreground"> · {portfolioWorkspaceHelpText(p.purpose)}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[0.8rem] text-muted-foreground">
                        Choose which workspace receives this valuation after the model runs. Matches the workspace pills under
                        the navigation bar so you can jump between personal and inheritance dashboards without mixing items.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}

              {currentStepId === "identity" && selectedType && identityFields.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2">
                  {identityFields.map((rawF) => (
                    <DynamicAssetFieldRow
                      key={rawF.key}
                      form={form}
                      rawF={rawF}
                      selectedRegion={selectedRegion}
                      selectedRegionName={selectedRegionName}
                      assetTypeId={selectedType.id}
                    />
                  ))}
                </div>
              )}

              {currentStepId === "valueDrivers" && selectedType && driverFieldsPage1.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2">
                  {driverFieldsPage1.map((rawF) => (
                    <DynamicAssetFieldRow
                      key={rawF.key}
                      form={form}
                      rawF={rawF}
                      selectedRegion={selectedRegion}
                      selectedRegionName={selectedRegionName}
                      assetTypeId={selectedType.id}
                    />
                  ))}
                </div>
              )}

              {currentStepId === "valueDrivers2" && selectedType && driverFieldsPage2.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2">
                  {driverFieldsPage2.map((rawF) => (
                    <DynamicAssetFieldRow
                      key={rawF.key}
                      form={form}
                      rawF={rawF}
                      selectedRegion={selectedRegion}
                      selectedRegionName={selectedRegionName}
                      assetTypeId={selectedType.id}
                    />
                  ))}
                </div>
              )}

              {currentStepId === "condition" && (
                <div className="space-y-3">
                  {identificationComplete ? (
                    <p className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-muted-foreground">
                      Condition was estimated from your verification answers. Adjust the slider if needed.
                    </p>
                  ) : null}
                  {selectedType?.id === SAAS_MICRO_ID ? (
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span>For software, this score is product maturity, not physical wear.</span>
                      <GlossaryHelp entry={GLOSSARY.maturity_score} label="maturity" />
                    </p>
                  ) : (
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span>Honest condition helps comps and listings.</span>
                      <GlossaryHelp entry={GLOSSARY.condition_scale} label="condition scale" />
                    </p>
                  )}
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <div className="mb-2 flex items-center justify-between">
                          <FormLabel>Score</FormLabel>
                          <span className="text-sm font-semibold tabular-nums">{field.value} / 10</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="[&_[role=slider]]:border-accent [&_[role=slider]]:bg-accent"
                          />
                        </FormControl>
                        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                          <span>Poor (1)</span>
                          <span>Mint / as new (10)</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {currentStepId === "purchasePrice" && purchaseFieldDef && selectedType && (
                <div className="space-y-2">
                  <DynamicAssetFieldRow
                    form={form}
                    rawF={purchaseFieldDef}
                    selectedRegion={selectedRegion}
                    selectedRegionName={selectedRegionName}
                    assetTypeId={selectedType.id}
                  />
                  <p className="text-xs text-muted-foreground">Skip if you prefer not to share this.</p>
                </div>
              )}

              {currentStepId === "additional" && (
                <FormField
                  control={form.control}
                  name="attributes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Any other details?</FormLabel>
                      <FormDescription>
                        One optional box for anything we did not ask. Receipts, flaws, urgency, or provenance.
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          placeholder="Example: includes third-party case, small chip on back, original buyer receipt in bag..."
                          className="min-h-[120px] resize-y bg-background"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {currentStepId === "itemVerification" && !identificationComplete ? null : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={goBack} disabled={wizardStep === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                {currentStepId === "purchasePrice" ? (
                  <Button type="button" variant="ghost" onClick={goNext}>
                    Skip
                  </Button>
                ) : null}
                {currentStepId !== "additional" ? (
                  <Button type="button" onClick={goNext}>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" className="shadow-lg">
                    Generate Valuer Report
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}

function NewEstimateClerkGate() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  return <NewEstimatePageInner authLoaded={authLoaded} isSignedIn={!!isSignedIn} />;
}

export default function NewEstimatePage() {
  const authStub = useAuthStubContext();
  if (authStub) {
    return <NewEstimatePageInner authLoaded isSignedIn />;
  }
  return <NewEstimateClerkGate />;
}
