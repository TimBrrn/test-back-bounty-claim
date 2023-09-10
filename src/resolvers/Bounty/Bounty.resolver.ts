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
    async bountyClaim(@Ctx() { user }: Context, 
    @Arg("claimCode", () => String) claimCode: string,
    
    ) {
        

        // Vérification de l'existance de l'utilisateur
        if (!user?.id) {
            throw new Error('User not found')
        }


        // Vérification de la date du dernier claim de l'utilisateur
        const now = new Date();
        const bountyClaim = await prisma.bountyClaim.findFirst({where: {fkUserId: user.id}})
        if(bountyClaim){
            const timeSinceLastClaim = now.getTime() - new Date(bountyClaim.timestamp).getTime()
            if (timeSinceLastClaim < 24 * 60 * 60 * 1000) {
                throw new Error ('bounty already claimed during the last 24 hours')
        }}
        

        // Vérification de l'existance d'un bounty actif et correspondant à claimCode 
        const bounty = await prisma.bounty.findUnique({where: {isActive: true, claimCode: claimCode}})       
        if (!bounty) {
            throw new Error("Invalid claim code or inactive bounty");
        }





        // Vérification si nombre de claim max atteint
        const bountyClaimTimes = await prisma.bountyClaim.findMany({where: {fkBountyId: bounty.id}})
        if (bountyClaimTimes.length === bounty.maxClaim) {
            throw new Error("Maximum claims for this bounty reached");
        }


        // Vérification si l'utilisateur a déjà réclamer le bounty
        if(await prisma.bountyClaim.findFirst({where:{fkUserId: user.id, fkBountyId: bounty.id}})){
            throw new Error("User has already claimed this Bounty.");
        }


        // Récupération de l'adresse IP de l'utilisateur
        const userIpAddress = await prisma.ipAddress.findFirst({where : {fkUserId: user.id}})

        if (!userIpAddress) {
            throw new Error("no IP address associated with the user.");
        }

        // Récupération de tous les comptes associés à cette adresse IP
        const usersWithSameIP = await prisma.user.findMany({
            where:{
                ipAddresses: {some: {address: userIpAddress.address}}}
        })

        // Vérifier si l'un des comptes a déjà réclamé le bounty 
        for (let user of usersWithSameIP){
            const claimed = await prisma.bountyClaim.findFirst({
                where: {
                    AND : [
                        {fkBountyId: bounty.id},
                        {fkUserId: user.id}
                    ]
                }
            })

            if (claimed){
                throw new Error ("bounty already claimed by this IP")
            }
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
                timestamp: new Date(),
                fkUserId: user.id,
                fkBountyId: bounty.id
            }
        });


        // Mise à jour du propriétaire du NFT 
        const lastNFT = await prisma.nft.update({where: { id: claimedNft.id }, data: { fkOwnerId: user.id }});


        return lastNFT; 
    }
}