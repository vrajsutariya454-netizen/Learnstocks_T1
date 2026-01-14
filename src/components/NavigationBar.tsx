
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart, BookOpen, ChevronDown, GamepadIcon, Home, PieChart, Search, Settings, TrendingUp, User } from "lucide-react";
import { cn } from "@/lib/utils";
import MainMenu from "./MainMenu";

const NavigationBar = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Home", href: "/home", icon: Home, current: location.pathname === "/home" },
    { name: "Profile", href: "/profile", icon: User, current: location.pathname === "/profile" },
    { name: "Search", href: "/search", icon: Search, current: location.pathname === "/search" },
    { name: "Games", href: "/games", icon: GamepadIcon, current: location.pathname === "/games" },
    { name: "Predictions", href: "/predictions", icon: TrendingUp, current: location.pathname === "/predictions" },
    { name: "PSG", href: "/psg", icon: BarChart, current: location.pathname === "/psg" },
    {
      name: "More",
      href: "/more",
      icon: ChevronDown,
      current: ["/more", "/diversification", "/learning"].includes(location.pathname),
      subItems: [
        { name: "Portfolio Diversification", href: "/diversification", icon: PieChart },
        { name: "Learning & Knowledge", href: "/learning", icon: BookOpen },
        { name: "Settings", href: "/settings", icon: Settings },
      ]
    }
  ];

  return (
    <nav className="bg-white border-b border-learngreen-200 px-4 py-2.5">
      <div className="flex flex-wrap justify-between items-center">
        <div className="flex items-center">
          <MainMenu />
          {window.location.hostname === "localhost" && (
            <span className="ml-2 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-bold border border-yellow-200">
              DEV
            </span>
          )}
        </div>

        <div className="flex md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center p-2 text-learngreen-500 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
        </div>

        <div className={cn("w-full md:block md:w-auto", mobileMenuOpen ? "block" : "hidden")}>
          <ul className="flex flex-col mt-4 md:flex-row md:space-x-8 md:mt-0 md:font-medium">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center py-2 px-3 rounded-md text-sm font-medium",
                    item.current
                      ? "bg-learngreen-100 text-learngreen-700"
                      : "text-gray-700 hover:bg-learngreen-50 hover:text-learngreen-700"
                  )}
                  aria-current={item.current ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden md:flex items-center">
          <Link to="/profile">
            <Button variant="ghost" size="sm" className="text-learngreen-500">
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default NavigationBar;
