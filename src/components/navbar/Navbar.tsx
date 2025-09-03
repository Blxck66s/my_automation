import { Link, type FileRouteTypes } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import ThemeSwitcher from "./ThemeSwitcher";

type NavTo = FileRouteTypes["to"];

interface NavItem {
  to: NavTo;
  label: string;
  preload?: "intent" | "render";
}

const navItems: NavItem[] = [
  { to: "/", label: "Home", preload: "intent" },
  { to: "/report", label: "Report Automate", preload: "intent" },
];

const hamburgerMenu = (
  <div className="flex-none lg:hidden">
    <label
      htmlFor="my-drawer-3"
      aria-label="open sidebar"
      className="btn btn-square btn-ghost"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        className="inline-block h-6 w-6 stroke-current"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4 6h16M4 12h16M4 18h16"
        ></path>
      </svg>
    </label>
  </div>
);

function Navbar() {
  const drawerToggleRef = useRef<HTMLInputElement | null>(null);

  const closeDrawer = useCallback(() => {
    if (drawerToggleRef.current?.checked) {
      drawerToggleRef.current.checked = false;
    }
  }, []);

  const renderLinks = (orientation: "horizontal" | "vertical") => (
    <ul
      className={
        orientation === "horizontal"
          ? "menu menu-horizontal"
          : "menu bg-base-200 min-h-full w-60 p-4 gap-2"
      }
    >
      <li className="px-2">
        {orientation === "horizontal" ? (
          <ThemeSwitcher compact />
        ) : (
          <ThemeSwitcher />
        )}
      </li>
      {navItems.map((item) => (
        <li key={item.to}>
          <Link
            to={item.to}
            preload={item.preload}
            activeProps={{
              className: "font-bold",
              "aria-current": "page",
            }}
            className="transition-colors hover:text-primary focus:outline-none focus-visible:ring focus-visible:ring-primary/50"
            onClick={closeDrawer}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="drawer w-fit p-4 pb-24">
      <input
        id="my-drawer-3"
        type="checkbox"
        className="drawer-toggle"
        ref={drawerToggleRef}
      />
      <div className="drawer-content flex flex-col">
        <div className="navbar bg-base-300 w-full rounded-md ">
          {hamburgerMenu}
          <div className="hidden flex-none lg:block">
            {/* Navbar menu content here */}
            {renderLinks("horizontal")}
          </div>
        </div>
      </div>
      <div className="drawer-side">
        <label
          htmlFor="my-drawer-3"
          aria-label="close sidebar"
          className="drawer-overlay"
        ></label>
        {/* Sidebar content here */}
        {renderLinks("vertical")}
      </div>
    </div>
  );
}

export default Navbar;
