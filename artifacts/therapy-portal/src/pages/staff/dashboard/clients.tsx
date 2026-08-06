import React, { useState } from 'react';
import { useGetClientHistory, getGetClientHistoryQueryKey, useSearchClients } from '@workspace/api-client-react';
import { format, parseISO } from 'date-fns';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, PhoneCall, Loader2, Calendar, FileText, Hash, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Clients() {
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');

  const { data: searchResults, isLoading: isSearching } = useSearchClients(activeSearch, {
    query: { retry: false },
  });

  const { data: clientHistory, isLoading, isError, error } = useGetClientHistory(selectedPhone, {
    query: {
      queryKey: getGetClientHistoryQueryKey(selectedPhone),
      enabled: selectedPhone.length > 0,
      retry: false
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveSearch(searchInput.trim());
      setSelectedPhone('');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary mb-2">Private records</p>
        <h1 className="text-3xl font-serif font-bold text-foreground">Client Directory</h1>
        <p className="text-muted-foreground mt-2">Search by client name, phone number, or confirmation code.</p>
      </div>

      <Card className="border-border shadow-sm rounded-2xl bg-card/80">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Name, phone, or confirmation code..."
                 data-testid="input-client-search" className="pl-10 h-12 rounded-xl"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
             <Button data-testid="button-search-client" type="submit" className="h-12 px-6 rounded-xl">Search</Button>
          </form>
        </CardContent>
      </Card>

       {(isSearching || isLoading) && (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

       {activeSearch && !isSearching && !isLoading && !searchResults?.clients.length && !clientHistory && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="pt-6 text-center py-12">
             <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">No Client Found</h3>
            <p className="text-muted-foreground">
              We couldn't find a client matching “{activeSearch}”.
            </p>
          </CardContent>
        </Card>
      )}

      {searchResults && searchResults.clients.length > 0 && !clientHistory && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold">Matching clients</h2>
            <span className="text-sm text-muted-foreground">{searchResults.clients.length} result{searchResults.clients.length === 1 ? '' : 's'}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {searchResults.clients.map((client) => (
              <Card key={client.phone} className="border-border shadow-sm rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-lg">{client.clientName}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1"><PhoneCall className="w-3.5 h-3.5" />{client.phone}</p>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 rounded-full whitespace-nowrap">
                      {client.sessionCount} session{client.sessionCount === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    {client.bookings.slice(-3).reverse().map((booking) => (
                      <button key={booking.id} onClick={() => setSelectedPhone(client.phone)} className="w-full text-left rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-primary" />{format(parseISO(booking.preferredDate), 'MMM d, yyyy')}</span>
                          <Badge variant="outline" className="capitalize text-[10px]">{booking.status}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1"><Hash className="w-3 h-3" />{booking.confirmationCode} · {booking.preferredTime}</span>
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4" onClick={() => setSelectedPhone(client.phone)}>View full history</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {clientHistory && !isError && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                {clientHistory.clientName}
                 <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 rounded-full">
                  {clientHistory.sessionCount} Sessions
                </Badge>
              </h2>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <PhoneCall className="w-4 h-4" />
                {clientHistory.phone}
              </p>
              <Button variant="link" className="px-0 mt-2" onClick={() => setSelectedPhone('')}>Back to matches</Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-serif text-xl font-bold border-b border-border pb-2">Session History</h3>
            
            <div className="grid grid-cols-1 gap-4">
              {clientHistory.bookings.map((booking) => (
                  <Card key={booking.id} className="border-border shadow-sm overflow-hidden rounded-2xl">
                   <CardHeader className="bg-muted/30 py-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 space-y-0">
                     <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Calendar className="w-4 h-4 text-primary" />
                        {format(parseISO(booking.preferredDate), 'MMMM d, yyyy')} at {booking.preferredTime}
                      </div>
                      <Badge variant="outline" className="capitalize text-xs">
                        {booking.status}
                      </Badge>
                    </div>
                    {booking.claimedBy && (
                      <span className="text-xs text-muted-foreground">
                        Staff: {booking.claimedBy}
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="py-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Reason provided</h4>
                        <p className="text-sm text-foreground bg-background rounded-lg border border-border/50 p-4">
                          {booking.reason}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Session Notes
                        </h4>
                        {booking.sessionNotes ? (
                          <div className="text-sm text-foreground bg-primary/5 rounded-lg border border-primary/10 p-4 whitespace-pre-wrap">
                            {booking.sessionNotes}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic bg-muted/30 rounded-lg border border-border/50 p-4">
                            No notes recorded for this session.
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
