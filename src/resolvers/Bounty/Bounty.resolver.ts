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
        

        // Vérification de l'existance de l'utilisateur
        if (!user?.id) {
            throw new Error('User not found')
        }


        // Vérification de la date du dernier claim de l'utilisateur
        const now = new Date();
        if(user.bountyClaimTimestamp.length > 0){
            const timeSinceLastClaim = now.getTime() - new Date(user.bountyClaimTimestamp[user.bountyClaimTimestamp.length - 1]).getTime()
            if (timeSinceLastClaim < 24 * 60 * 60 * 1000) {
                throw new Error ('bounty already claimed during the last 24 hours')
        }}
        

        // Vérification de l'existance d'un bounty actif et correspondant à claimCode 
        const bounty = await prisma.bounty.findUnique({where: {isActive: true, claimCode: claimCode}})       
        if (!bounty) {
            throw new Error("Invalid claim code or inactive bounty");
        }


        // Vérification du nombre de bounty restants 
        if (bounty.bountyClaim === bounty.maxClaim) {
            throw new Error("Maximum claims for this bounty reached");
        }


        // Vérification si l'utilisateur a déjà réclamer le bounty
        if(await prisma.bountyClaim.findFirst({where:{fkUserId: user.id, fkBountyId: bounty.id}})){
            throw new Error("User has already claimed this Bounty.");
        }


        // Vérification si l'adresse IP de l'utilisateur a déjà réclamer le bounty
        if(user.ip && bounty.claimedByIp.includes(user.ip)){
            throw new Error ("bounty already claimed by this ip addresse")

        }
       

        // Recherche de NFTs n'ayant aucun propriétaire et associés au bounty 
        const availableNfts = await prisma.nft.findMany({
            where: {
                AND: [
                    { fkOwnerId: null }, 
                    { fkTrackId: bounty.fkTrackId },
                ]}})

        if (availableNfts.length === 0) {
            throw new Error("No available NFTs for claiming");
        }
        

        // Vérification si le bounty est random
        const claimedNft = bounty.isRandom
        ? availableNfts[Math.floor(Math.random() * availableNfts.length)]
        : availableNfts[0];
        

        // Création d'un fichier pour indiquer que cette utilisateur a déjà claim (même après avoir envoyé son nft à un autre utilisateur)
        await prisma.bountyClaim.create({
        data: {
                claimedAt: new Date(),
                fkUserId: user.id,
                fkBountyId: bounty.id
            }
        });
        

        // Mise à jour du nombre de bounty claim
        await prisma.bounty.update({where:{id: bounty.id}, data:{bountyClaim : {increment: 1 }}})
        

        // Mise à jour du bounty en lui associant l'adresse IP de l'utilisateur 
        if (user.ip){
        await prisma.bounty.update({where:{id : bounty.id},data:{claimedByIp:{push:user.ip}}
        })}
        
       
        // Mise à jour du dernier claim de l'utilisateur (timestamp)
        await prisma.user.update({where: {id: user.id}, data:{bountyClaimTimestamp:{push: new Date()}}})


        // Mise à jour du propriétaire du NFT 
        await prisma.nft.update({where: { id: claimedNft.id }, data: { fkOwnerId: user.id }});


        return claimedNft; 
    }
}