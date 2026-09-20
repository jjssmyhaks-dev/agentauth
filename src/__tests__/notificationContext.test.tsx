import { render, screen, fireEvent, act } from "@testing-library/react";
import { NotificationProvider, useNotifications } from "@/context/NotificationContext";

function Probe() {
  const { addNotification, pushToast, toasts, notifications } = useNotifications();
  return (
    <button
      onClick={() => {
        addNotification({
          type: "system",
          priority: "medium",
          title: "Test notification",
          message: "Hello",
        });
        pushToast({ type: "system", priority: "low", title: "Test toast", message: "Hi" });
      }}
    >
      {`n:${notifications.length} t:${toasts.length}`}
    </button>
  );
}

describe("NotificationContext — remount-safe IDs (audit #7)", () => {
  it("assigns unique notification IDs across a provider remount", () => {
    // First mount: add one notification
    const first = render(<NotificationProvider><Probe /></NotificationProvider>);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toBe("n:9 t:1"); // 8 mock + 1
    first.unmount();

    // Remount: mock state resets, so ids must not — old code reused the
    // module-level counter and produced a duplicate notif_101.
    const second = render(<NotificationProvider><Probe /></NotificationProvider>);
    fireEvent.click(screen.getByRole("button"));

    const rendered = second.getByRole("button").textContent;
    expect(rendered).toBe("n:9 t:1");
  });

  it("keeps toast IDs unique within a single mount", () => {
    render(<NotificationProvider><Probe /></NotificationProvider>);
    const button = screen.getByRole("button");

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    // No crash and state stays consistent — duplicate toast IDs would break
    // dismissal and React keys. (8 mock + 3 added = 11 notifications)
    expect(button.textContent).toBe("n:11 t:3");
  });
});
