"use client"
import React, { forwardRef, useImperativeHandle, useRef } from "react"
import { Drawer } from "vaul"

const VaulDrawer = forwardRef(({ book, coverUrl }, ref) => {
  const { title, author, description, amazon_affiliate_link } = book
  const triggerRef = useRef()

  useImperativeHandle(ref, () => ({
    open: () => {
      if (triggerRef.current) {
        triggerRef.current.click()
      }
    }
  }))

  console.log("VaulDrawer rendered with book:", book, book.title)

  return (
    <Drawer.Root direction="right">
      <Drawer.Trigger ref={triggerRef} className="hidden" />
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-10" />
        <Drawer.Content
          className="right-0 top-0 bottom-0 fixed z-10 outline-none w-[840px] max-w-full flex"
          style={{ "--initial-transform": "calc(100% + 8px)" }}
        >
          <section className="drawer-container bg-white w-[840px] h-full flex flex-row">
            <div className="drawer-left w-4 h-full border border-solid border-border"></div>
            <div className="drawer-center w-full h-full flex flex-col">
              <div className="drawer-top w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
              <div className="drawer-content flex flex-col h-full items-center justify-center">
                <div className="content-container flex flex-col w-[332px] max-w-full">
                  {coverUrl && <img src={coverUrl} alt={`${title} cover`} className="w-full h-auto" />}
                  <Drawer.Title className="text-[16px] text-textPrimary font-EB_Garamond">{title}</Drawer.Title>
                  <Drawer.Description className="text-[16px] font-EB_Garamond text-textSecondary">
                    By <span className="text-textPrimary">{author}</span>
                  </Drawer.Description>
                </div>
              </div>
              <div className="drawer-bottom w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
            </div>
            <div className="drawer-right w-4 h-full border border-solid border-border"></div>
          </section>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
})

VaulDrawer.displayName = "VaulDrawer"

export default VaulDrawer
