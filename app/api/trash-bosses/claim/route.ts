import {requireViewer} from '@/lib/viewer-auth';
import {communityJson} from '@/lib/community-request';
import {apiError} from '@/lib/site-db';
import {claimBoss} from '@/lib/trash-boss-claims';
export async function POST(request:Request){try{const who=await requireViewer(request,'twitch'),body=await communityJson(request);return Response.json({id:await claimBoss(who.name,Number(body.boss))});}catch(e){return apiError(e);}}
