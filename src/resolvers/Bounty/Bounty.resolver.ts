import { Arg, Ctx, Mutation, Resolver } from "type-graphql";

import { Context } from "@/schema";
import { Bounty } from "@/resolvers/Bounty/Bounty.type";
import { Nft } from "@/resolvers/Nft/Nft.type";

import { prisma } from "@/prisma";



@Resolver(() => Bounty)
export class BountyResolver {
    /**
     * Attempt to claim a bounty with a claim code.
     * There are multiple restrictions on claiming a bounty:
     * (1) The bounty must be active ++
     * (2) The bounty must not have been claimed by this user
     * (3) The claim code must be the correct claim code for the bounty
     * (4) The NFT claimed cannot be owned by a user
     * An error will be thrown if any of these restrictions are not met.
     *
     * (5) If the bounty is successfully claimed, the user will become owner of an NFT.
     * (6) If the bounty's random property is true, the NFT will be random from the bounty's NFTs.
     *
     * @param context - The context of the request
     * @param claimCode - The claim code used to claim the bounty
     *
     * @returns The NFT claimed
     */
    
    @Mutation(() => Nft)
    async bountyClaim(@Ctx() { user }: Context, @Arg("claimCode", () => String) claimCode: string) {
        
        // check if the user exist
        if (!user?.id) {
            throw new Error('User not found')
        }

        // check last claim 
        const now = new Date();
        if(user.bountyClaimTimestamp && user.bountyClaimTimestamp.length > 0){
            const lastClaimDate = new Date(user.bountyClaimTimestamp[user.bountyClaimTimestamp.length - 1]);
            const timeSinceLastClaim = now.getTime() - lastClaimDate.getTime()

        // check if timeSinceLastClaim < 24 hours
        if (timeSinceLastClaim < 24 * 60 * 60 * 1000) {
            throw new Error ('bounty already claimed during the last 24 hours')
        }};

        
            


        // check if the bounty is active & claim code is true - (1) (3)
        const bounty = await prisma.bounty.findUnique({
            where: {isActive:true, claimCode:claimCode}   //check (1) & (3)          
        })


        // throw error if (1) or (3) not true
        if (!bounty) {
            throw new Error("Invalid claim code or inactive/public bounty");
        }

        // check if bountyMax reach or not
        if (bounty.bountyClaim === bounty.maxClaim) {
            throw new Error("Maximum claims for this bounty reached");
        }


        // check if user ip has already claimed the bounty
        const userIp = user.ip
        let hasClaimed = false

        if(userIp){
          hasClaimed = bounty.claimedByIp.includes(userIp)
        }

        // if IP addresse has already claimed, throw error
        if (hasClaimed){
            throw new Error ("bounty already claimed by this ip addresse")
        }

        
        
        // check if the user has already claimed this bounty using the bountyClaim - check (2)
        const existingClaim = await prisma.bountyClaim.findFirst({
            where:{fkUserId: user.id, fkBountyId: bounty.id}
        })
        
        if (existingClaim) {
            throw new Error("User has already claimed this Bounty.");
        }
        
        // if not, record the claim in bountyClaim table
        await prisma.bountyClaim.create({
            data: {
                claimedAt: new Date(),
                fkUserId: user.id,
                fkBountyId: bounty.id
            }
        });
        
        
        // increase the value of bountyClaim by 1 after user is ok for claim
        await prisma.bounty.update({
            where:{id: bounty.id},
            data:{bountyClaim : {increment: 1 }}
        })
        
        
        // find nfts that can be claimed : no owner + same track as bounty - check (4)
        const availableNfts = await prisma.nft.findMany({
            where: {
                AND: [
                    { fkOwnerId: null }, // nft is not owned by anyone
                    { fkTrackId: bounty.fkTrackId }, // same track as bounty
                ],
            },
        });
        
        // throw error if no nft available
        if (availableNfts.length === 0) {
            throw new Error("No available NFTs for claiming");
        }
        
        // check if bounty is random 
        // -> if true, return a random nft 
        // -> if not, return nft starting from number 1 (index[0]) - check (6)
        const claimedNft = bounty.isRandom
        ? availableNfts[Math.floor(Math.random() * availableNfts.length)]
        : availableNfts[0];
        
        // add the IP addresse into the arr and update
        if (userIp){
        await prisma.bounty.update({
            where:{id : bounty.id},
            data:{
                claimedByIp:{
                    push:userIp
                }
            }
        })}
        
        // update nft ownership - check (5)
        await prisma.nft.update({
            where: { id: claimedNft.id }, // find nft id
            data: { fkOwnerId: user.id }, // update owner with user id
        });

      
        return claimedNft; 
    }
}