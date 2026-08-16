import { useEffect } from "react";
import { Providers } from "@/app/Providers";
import { AppRouter } from "@/router";
import { useUiStore } from "@/store/ui-store";

function App() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <Providers>
      <AppRouter />
    </Providers>
  );
}

export default App;
