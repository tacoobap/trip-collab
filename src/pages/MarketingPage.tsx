import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BoardMockup, CollectionMockup, ShareMockup } from '@/components/marketing/Mockups'

/**
 * What a signed-out visitor lands on at `/`.
 *
 * Most arrivals here are invitees who followed a link, so the way in stays one
 * click away at every scroll position — but the page still has to answer "what
 * am I being invited into" for someone who's never seen the app.
 */
export function MarketingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="w-4 h-4" aria-hidden />
            </span>
            <span className="font-serif text-lg font-bold text-foreground">Trup</span>
          </div>
          <Link to="/sign-in">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-5 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <div className="max-w-xl">
              <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground leading-[1.1] text-balance">
                Plan the trip together, not in a group chat and a shared doc.
              </h1>
              <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
                Right now it's split three ways — messages, someone's calendar,
                and a doc that stopped being true a week ago. Here it's one
                board, and one link that hands it to everyone.
              </p>
              <div className="mt-8">
                <Link to="/sign-in">
                  <Button size="lg">Start planning</Button>
                </Link>
                <p className="mt-3 text-sm text-muted-foreground">
                  Free, and your crew doesn't need an account to read the plan.
                </p>
              </div>
            </div>

            <div>
              <BoardMockup />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                The board: days across, hours down.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 bg-card/40">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-16 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
              <div className="lg:order-2 max-w-xl">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground text-balance">
                  Park the maybes
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  Anything you already know goes straight onto a day — the
                  flight, the dinner you've booked. Everything else can wait in
                  the collection: a restaurant, a hike, the bar someone's cousin
                  swears by. Paste a maps link and it fills in the rest. Likes
                  show what the group actually wants, and whatever makes the cut
                  gets dragged onto a day.
                </p>
              </div>
              <div className="lg:order-1 max-w-md w-full mx-auto">
                <CollectionMockup />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-16 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
              <div className="max-w-xl">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground text-balance">
                  One link, and everyone's caught up
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  The plan becomes a proper itinerary — day by day, with times,
                  addresses and where you're staying. Share it and anyone can
                  read it without signing in, or save it as a PDF for the flight.
                </p>
              </div>
              <div className="max-w-md w-full mx-auto">
                <ShareMockup />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 bg-card/40">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 text-center">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground text-balance">
              Got a trip coming up?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Start a trip, share the link, let everyone pile in.
            </p>
            <div className="mt-6">
              <Link to="/sign-in">
                <Button size="lg">Start planning</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Trup</span>
          <span>
            <Link to="/privacy" className="hover:text-foreground underline">Privacy</Link>
            {' · '}
            <Link to="/terms" className="hover:text-foreground underline">Terms</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
