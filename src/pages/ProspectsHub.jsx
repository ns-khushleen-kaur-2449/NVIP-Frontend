import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LeadsPage from '@/pages/Leads';
import ProspectingPage from '@/pages/Prospecting';

/** New-mode prospects workspace: the tenant's saved list and the existing lead finder. */
export default function ProspectsHub() {
  const [tab, setTab] = useState('list');
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Prospects</h1><p className="mt-1 text-sm text-muted-foreground">Browse your prospects or find people to add to a campaign.</p></div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="list">Prospect list</TabsTrigger><TabsTrigger value="find">Find prospects</TabsTrigger></TabsList>
        <TabsContent value="list"><LeadsPage /></TabsContent>
        <TabsContent value="find"><ProspectingPage /></TabsContent>
      </Tabs>
    </div>
  );
}
