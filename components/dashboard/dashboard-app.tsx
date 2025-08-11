"use client"
import type React from "react"
import UserAppHeader from "../user-app/user-app-header" 
import { DashboardNavBar } from "./dashboard-nav-bar" 


interface DashboardAppProps {
    children: React.ReactNode
}

export function DashboardApp({ children }: DashboardAppProps) {
    return (
        <>
            <div className="flex flex-col h-screen bg-black text-white">
                <UserAppHeader />
                <DashboardNavBar />
                <div className="flex flex-1 overflow-hidden">
                    <main className={`
                        flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-zinc-900 rounded-tl-xl
                        transition-all duration-300 ease-in-out
                    `}>
                        {children}
                    </main>
                </div>
            </div>
        </>
    )
}
