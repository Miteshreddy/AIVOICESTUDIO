import { useGenerationsStore } from "@/store/generations-store";

// Projects are backed directly by real generation history — every piece of
// generated speech shows up here, across the whole app, not just this tab.
export const useProjectsStore = useGenerationsStore;
